import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { aiJson } from "@/lib/ai";
import { fallbackBrief } from "@/lib/degraded";
import { buildProfile, getLearner, dueCount } from "@/lib/server";
import { getRivalView, ensureQuests, getChain } from "@/lib/arcade";
import { nextBestActions } from "@/lib/next-best";
import { contentUserId } from "@/lib/scope";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PERSONAS = {
  mentor: "a warm, sharp mentor who respects the learner's intelligence",
  drill: "a drill sergeant: short sentences, high standards, zero fluff, still on the learner's side",
  zen: "a calm zen teacher: patient, observes patterns without judgment, nudges rather than pushes",
} as const;

interface Brief {
  priority: string; // the ONE thing that matters today
  plan: string[]; // exactly 3 concrete moves, each naming the surface
  pep: string; // one closing line in persona voice
  // Degraded honesty (audit P1-7): set when the AI Director was unreachable
  // and the engine-worded plan was served instead. Cached briefs carry the
  // flag, so the client chips it until a real AI brief replaces it.
  degraded?: boolean;
  degradedNotice?: string;
}

// GET: today's briefing, generated once and cached; ?force=1 regenerates.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const today = dayIndex();
  const cached = await db.briefing.findUnique({ where: { day: today } });
  if (cached && !force && cached.text) {
    const brief = JSON.parse(cached.text) as Brief;
    return NextResponse.json({ brief, cached: true, persona: (await getLearner()).persona, degraded: Boolean(brief.degraded) });
  }
  const l = await getLearner();
  const persona = (PERSONAS as Record<string, string>)[l.persona] ?? PERSONAS.mentor;
  const profile = await buildProfile();
  await ensureQuests();
  const uB = await contentUserId().catch(() => "me");
  const [rival, due, chain, quests, nextBest] = await Promise.all([
    getRivalView(),
    dueCount(),
    getChain(),
    db.quest.findMany({ where: { userId: uB, day: today } }),
    nextBestActions(),
  ]);
  const context = {
    level: profile.level,
    streak: profile.streak,
    due,
    chain,
    weakTags: profile.mistakes?.slice(0, 5) ?? [],
    weakSkills: profile.weakSkills,
    rival: { name: rival.name, you: rival.you, them: rival.weekXp },
    quests: quests.map((q) => ({ title: q.title, progress: q.progress, target: q.target, done: q.done })),
    // The engine has already DECIDED today's moves, with reasons. The
    // Director words them, never overrides them: priority and plan must
    // follow this list (rephrased in persona voice, not replaced).
    enginePlan: nextBest.map((a) => `${a.action} ${a.target} (${a.reason})`),
  };
  let brief: Brief;
  try {
    brief = await aiJson<Brief>(
      `You are the AI Director inside Rah, an English-learning app for a Farsi speaker climbing from B2 to C1. Right now you are ${persona}. Write today's briefing.

Rules: priority is ONE sentence naming the single highest-leverage thing for today, chosen from the real data. If enginePlan is present, your priority and plan MUST follow it (rephrase in your persona voice; never invent different moves). plan is exactly 3 items, each a concrete move that names the surface to open (Review, Coach, Writing, Speaking, Listening, Reading, Arcade games like Speed Round/Boss Battle/Daily Dungeon/Rival Duel/Gauntlet/Focus Flow) and why it attacks this learner's actual leaks. pep is one closing line in your persona voice, no emojis, no hashtags. Reply with ONLY this JSON: {"priority": string, "plan": [string, string, string], "pep": string}`,
      [{ role: "user", content: JSON.stringify(context) }],
    );
  } catch {
    // Degraded honesty (audit P1-7): a provider outage must not brick the
    // dashboard's first screen (it used to 500 into "nothing worth saying").
    // The engine already decided the moves; word them deterministically and
    // LABEL the brief as engine-built. Cached like a normal brief (bounded
    // calls), flagged inside the stored JSON, Re-brief retries the AI.
    brief = fallbackBrief(context.enginePlan, l.persona);
  }
  await db.briefing.upsert({ where: { day: today }, create: { day: today, text: JSON.stringify(brief) }, update: { text: JSON.stringify(brief) } });
  return NextResponse.json({ brief, cached: false, persona: l.persona, degraded: Boolean(brief.degraded) });
}

// POST: persona switch ({persona}) or forced regeneration ({regen:true}).
export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const b = (await req.json()) as { persona?: string; regen?: boolean };
  const l = await getLearner();
  if (b.persona && ["mentor", "drill", "zen"].includes(b.persona)) {
    await db.learner.update({ where: { id: "me" }, data: { persona: b.persona } });
    return NextResponse.json({ ok: true, persona: b.persona });
  }
  if (b.regen) {
    const today = dayIndex();
    await db.briefing.upsert({ where: { day: today }, create: { day: today, text: "" }, update: { text: "" } });
    const url = new URL(req.url);
    const brief = await GET(new Request(`http://local/?force=1&x=${url.search}`));
    return NextResponse.json(await brief.json());
  }
  return NextResponse.json({ ok: false, error: "nothing to do" }, { status: 400 });
}
