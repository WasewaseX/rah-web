import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, profileBlock } from "@/lib/ai";
import { DEGRADED_CONVERSATION_LINE, degradedTurnPayload } from "@/lib/degraded";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";
import { awardXp, progressQuest } from "@/lib/arcade";
import { recordMistakes } from "@/lib/mistakes";
import { ladderFor, ladderBrief } from "@/lib/ladder";
import { dayIndex } from "@/lib/fsrs";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// SPEAK RE wave, part 2 (the 7.4/10 review's #1: "real-time voice
// conversations"). VoiceArena is the fixed shadowing gauntlet; this is the
// FREE conversation: a scenario, the learner speaks (browser ASR), the coach
// answers in-scene with trap-tagged corrections, up to 6 turns, then a
// deterministic report. Coach lines are spoken client-side via
// speechSynthesis (the VoiceArena convention - zero config, visible text
// always). Engine decides: the report scores are computed from what actually
// happened in the turns, never from the AI's opinion of itself.

interface Scenario {
  id: string;
  title: string;
  scene: string;
  opening: string;
  goal: string;
  skill: string; // trap family this scenario is most likely to provoke
}

// Deterministic scenario bank. Each targets a Farsi-interference family so
// the conversation pressure-tests a real weakness, like the arena does.
const SCENARIOS: Scenario[] = [
  { id: "complain", title: "Faulty order", scene: "You call a shop about a laptop that arrived with a cracked screen. You want a refund or a fast replacement - stay firm but polite.", opening: "Thanks for calling TechLine support, this is Dana. How can I help you today?", goal: "get the refund or replacement", skill: "register" },
  { id: "interview", title: "Job interview", scene: "A hiring manager asks about your background and a real failure. Answer with specifics, not memorized phrases.", opening: "So, walk me through your background - and I'd love a real example of a project that went wrong.", goal: "answer with concrete specifics", skill: "perfect" },
  { id: "explain", title: "Explain your work", scene: "Explain what you do to a curious 12-year-old. No jargon survives unless you define it.", opening: "My friend says you have a complicated job. Explain it to me like I'm twelve.", goal: "explain without jargon", skill: "countability" },
  { id: "persuade", title: "Change my mind", scene: "A friend thinks learning languages with apps is a waste of time. Convince them with arguments, not enthusiasm.", opening: "Honestly? I deleted every learning app. They're all just games. Why would yours be different?", goal: "persuade with arguments", skill: "word_choice" },
  { id: "apologize", title: "Missed deadline", scene: "You promised a colleague a translation two days ago. It's not done. Own it and propose a concrete fix.", opening: "Hey - I still don't have that file you promised. What happened?", goal: "own it and propose a fix", skill: "prepositions" },
  { id: "smalltalk", title: "New neighbour", scene: "First meeting with a new neighbour at the door. Small talk that actually goes somewhere - find one thing in common.", opening: "Hi! You just moved in, right? I'm Sam from 4B. Welcome to the building!", goal: "find one thing in common", skill: "articles" },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_TURNS = 6;

export async function GET() {
  // Deterministic per (scenario set, day): same conversation offered all day,
  // like the pairs board and the bank tray. Weakness-bias: the scenario whose
  // skill matches the learner's hottest active mistake family goes first.
  const day = dayIndex();
  const rng = mulberry32(day * 7919 + 13);
  const order = [...SCENARIOS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  let favored = "";
  try {
    const { topMistakes } = await import("@/lib/mistakes");
    const fams = await topMistakes(6);
    favored = fams.find((f) => !f.resolvedAt && SCENARIOS.some((s) => s.skill === f.tag))?.tag ?? "";
  } catch {
    // fresh db - no bias
  }
  if (favored) {
    const hot = order.find((s) => s.skill === favored);
    if (hot) {
      order.splice(order.indexOf(hot), 1);
      order.unshift(hot);
    }
  }
  return NextResponse.json({
    scenarios: order.map((s) => ({ id: s.id, title: s.title, scene: s.scene, goal: s.goal, opening: s.opening })),
    maxTurns: MAX_TURNS,
  });
}

interface TurnIn {
  you?: unknown;
  coach?: unknown;
}

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const body = await req.json().catch(() => ({}));
  const scenarioId = String((body as { scenarioId?: unknown }).scenarioId ?? "");
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) return NextResponse.json({ error: "Unknown scenario." }, { status: 400 });

  const rawArr = Array.isArray((body as { turns?: unknown }).turns) ? (((body as { turns: unknown[] }).turns ?? []) as TurnIn[]) : [];
  // More than MAX_TURNS from a client is a bug or an attack, not a long
  // conversation - reject it (the client always sends <= 6). Never clamp a
  // live model call out of garbage.
  if (rawArr.length > MAX_TURNS) return NextResponse.json({ error: `The conversation caps at ${MAX_TURNS} turns.` }, { status: 400 });
  const rawTurns = rawArr.slice(0, MAX_TURNS);
  const turns = rawTurns
    .map((t) => ({ you: String(t.you ?? "").slice(0, 1200).trim(), coach: String(t.coach ?? "").slice(0, 600).trim() }))
    .filter((t) => t.you.length > 0);
  if (turns.length === 0) return NextResponse.json({ error: "Say something first - the transcript is empty." }, { status: 400 });
  if (turns.length > MAX_TURNS) return NextResponse.json({ error: `The conversation caps at ${MAX_TURNS} turns.` }, { status: 400 });

  const done = turns.length >= MAX_TURNS || Boolean((body as { end?: unknown }).end);
  const profile = await buildProfile();
  const lad = ladderFor(profile.level);

  const historyText = turns.map((t, i) => `Turn ${i + 1} - learner: ${t.you}\nTurn ${i + 1} - you: ${t.coach || "(scene opening)"}`).join("\n");
  const last = turns[turns.length - 1];

  const system = `You are the voice conversation partner inside Rah, an English app for a Farsi speaker around ${profile.level}. You are IN THE SCENE.
SCENE: ${scenario.scene}
YOUR OPENING LINE WAS: "${scenario.opening}"
THE LEARNER'S GOAL: ${scenario.goal}

Rules:
- reply: stay in the scene, 1 to 3 spoken sentences, natural register, end by pushing the scene forward (a question, a complication, or - if the goal is met - a natural closing line).
- corrections: up to 2 real production errors from the learner's last message ONLY, each with a Farsi "fa" explanation and a "trap" tag (statives, articles, countability, plurals, copula, prepositions, perfect, question_order, adjectives, that_omission, word_choice, register).
- Do not break character to teach. The corrections array is the teaching.
- No Farsi in the reply field. Never use the em dash character.
${ladderBrief(lad, "speak")}`;

  let turnOut: { reply?: string; corrections?: { wrong?: string; right?: string; fa?: string; trap?: string }[] };
  // Degraded honesty (audit P1-7): the () => ({}) fallback used to render a
  // silent "..." coach line - degraded content presented as if the partner
  // really spoke. Track it, swap in the honest in-scene placeholder line, and
  // flag the turn so the UI can banner it.
  let degradedFallback = false;
  try {
    turnOut = await aiJson<{ reply?: string; corrections?: { wrong?: string; right?: string; fa?: string; trap?: string }[] }>(
      system + "\n\n" + profileBlock(profile),
      [
        {
          role: "user",
          content: `${historyText}\n\nThe learner just said (turn ${turns.length}): "${last.you}"\n${
            done
              ? "The scene is ending - give a warm in-character sign-off."
              : "Continue the scene."
          }`,
        },
      ],
      () => ({}),
      {
        deep: false,
        temperature: 0.7,
        degraded: () => {
          degradedFallback = true;
        },
      },
    );
  } catch (e) {
    return NextResponse.json({ error: `Coach is unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  const coachLine = degradedFallback ? DEGRADED_CONVERSATION_LINE : String(turnOut.reply ?? "").trim() || "...";
  const corrections = (Array.isArray(turnOut.corrections) ? turnOut.corrections.slice(0, 2) : []).map((c) => ({
    wrong: String(c.wrong ?? "").slice(0, 120),
    right: String(c.right ?? "").slice(0, 120),
    fa: String(c.fa ?? "").slice(0, 300),
    trap: String(c.trap ?? "none"),
  }));

  // The mouth feeds the same memory as the pen (and the speak lab).
  if (corrections.length > 0) {
    await recordMistakes(corrections.filter((c) => c.wrong).map((c) => ({ kind: "speak" as const, tag: c.trap, wrong: c.wrong, right: c.right })));
  }

  await bumpDaily("spoken");
  await touchStreak();
  await awardXp(done ? 15 : 3, { chainHit: true });
  await progressQuest("speak_1", 1);

  // On the final turn, persist a SpeakSession so the Improvement ledger sees
  // the conversation with HONEST engine-computed scores (not AI self-scores).
  let report: Record<string, unknown> | null = null;
  if (done) {
    const words = turns.map((t) => t.you.split(/\s+/).filter(Boolean).length);
    const avgWords = words.reduce((a, b) => a + b, 0) / words.length;
    const corrTotal = corrections.length;
    const clamp10 = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));
    // Deterministic proxies: accuracy is dinged 0.5 per correction across the
    // whole conversation (client accumulates the tally into trapCount),
    // fluency rewards sustained turns of ~40+ words.
    const trapCount = Math.max(0, Math.min(40, Number((body as { trapCount?: unknown }).trapCount ?? 0)) + corrTotal);
    const accuracy = clamp10(10 - 0.5 * trapCount);
    const fluency = clamp10(4 + avgWords / 8);
    const scores = { fluency, range: clamp10(5 + Math.min(5, new Set(last.you.toLowerCase().split(/\s+/)).size / 6)), accuracy, delivery: clamp10((fluency + accuracy) / 2) };
    report = { scores, turns: turns.length, corrections: trapCount, scenario: scenario.id, goal: scenario.goal };
    await db.speakSession.create({
      data: {
        prompt: `conversation: ${scenario.title}`,
        transcript: turns.map((t) => `You: ${t.you}\nCoach: ${t.coach}`.slice(0, 2400)).join("\n---\n").slice(0, 5000),
        round: 1,
        result: JSON.stringify({ scores, errors: corrections.map((c) => ({ bad: c.wrong, good: c.right, fa: c.fa, trap: c.trap })), upgrades: [], round2: { constraint: "Run the conversation again - same scene, fewer traps.", same_prompt: true }, verdict: `${turns.length}-turn conversation in "${scenario.title}".`, fa_note: "" }),
      },
    });
  }

  return NextResponse.json({ coachLine, corrections, done, report, ...(degradedFallback ? degradedTurnPayload() : {}) });
}
