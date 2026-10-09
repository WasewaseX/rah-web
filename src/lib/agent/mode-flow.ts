// Conversation modes. Four flows live on top of the skill registry:
// roleplay (scenario partner), debate (scored argumentation), socratic
// (guide-don't-tell tutoring) and daily (one challenge item awaiting its
// answer). A mode persists on the Learner row, so it survives page reloads,
// and every mode has clean exits that return the learner to the coach with
// feedback instead of leaving them stranded.

import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";
import { aiJson, profileBlock } from "@/lib/ai";
import { gradeAnswer } from "./fuzzy";
import { noteExamAnswer } from "@/lib/mistakes";
import type { CoachEnvelope, SkillId, StepTrace } from "./types";
import type { ProfileJson } from "@/lib/ai";

export interface ModeData {
  scene?: string;
  goal?: string;
  partner?: string;
  topic?: string;
  side?: string;
  round?: number;
  item?: { q: string; choices?: string[]; a: string; accept?: string[]; tag?: string; skill?: string; why?: string; type?: string };
  shown?: boolean;
  startedAt?: number;
}

const EXIT = /^(end|stop|exit|quit|finish)( (the )?(scene|debate|mode|roleplay|challenge|this))?$/i;
const SKIP = /^(skip|pass|reveal|show the answer|i give up|give up)$/i;

export async function clearMode(modeNote?: string): Promise<void> {
  await db.learner.update({ where: { id: "me" }, data: { mode: "coach", modeData: "" } });
  if (modeNote) console.log(`[mode] cleared: ${modeNote}`);
}

const MODE_SKILL: Record<string, SkillId> = { roleplay: "roleplay", debate: "debate", socratic: "socratic", daily: "daily-challenge" };

function envelope(skill: SkillId, reply: string, steps: StepTrace[], corrections: CoachEnvelope["corrections"] = []): CoachEnvelope {
  return { skill, reply, corrections, fa_note: "", steps };
}

// The gate runCoach consults before normal routing. Returns null when no
// mode is active; otherwise it IS the turn - the coach speaks through it.
export async function runModeFlow(
  text: string,
  history: { role: string; content: string }[],
  p: ProfileJson,
  emit: (l: string, d?: string) => void,
): Promise<CoachEnvelope | null> {
  const learner = await getLearner();
  const mode = learner.mode;
  if (!mode || mode === "coach") return null;
  let data: ModeData = {};
  try {
    data = JSON.parse(learner.modeData || "{}") as ModeData;
  } catch {
    data = {};
  }
  const steps: StepTrace[] = [{ label: `Mode: ${mode}`, detail: "persistent conversation state" }];

  // Universal exits - every mode wraps up gracefully, never strands.
  if (EXIT.test(text.trim()) || /^(socratic )?off$/i.test(text.trim()) || text.trim().toLowerCase() === "/end") {
    emit("Leaving mode", mode);
    await clearMode(mode);
    const wrap = await wrapUp(mode, data, p);
    return envelope(MODE_SKILL[mode] ?? "chat", wrap, [...steps, { label: "Mode closed", detail: "back to the coach" }]);
  }

  if (mode === "daily") {
    return dailyTurn(text, data, p, steps, emit);
  }
  if (mode === "roleplay") {
    return roleplayTurn(text, data, p, steps, history, emit);
  }
  if (mode === "debate") {
    return debateTurn(text, data, p, steps, history, emit);
  }
  if (mode === "socratic") {
    return socraticTurn(text, data, p, steps, history, emit);
  }
  return null;
}

async function wrapUp(mode: string, data: ModeData, p: ProfileJson): Promise<string> {
  if (mode === "daily" && data.item) {
    return `The answer was "${data.item.a}". ${data.item.why ?? ""} Back in coach mode: tell me what to practice, or ask for "generate an exam".`;
  }
  try {
    const out = await aiJson<{ reply?: string }>(
      `You are Rah, an English coach for a Farsi speaker around ${p.level}. A ${mode} session just ended${
        mode === "debate" ? ` on the topic: ${data.topic ?? "the debate"}` : mode === "roleplay" ? ` (scenario: ${data.scene ?? "the scene"})` : ""
      }. Write the wrap-up: 2 short English sentences on what the learner did well and ONE specific thing to work on next time. No questions, no JSON, no Farsi.`,
      [{ role: "user", content: "end of session" }],
      () => ({}),
      { deep: false, temperature: 0.5 },
    );
    const reply = String(out.reply ?? "").trim();
    return reply ? `${reply} Back in coach mode.` : "Session closed. Back in coach mode: what is next?";
  } catch {
    return "Session closed. Back in coach mode: what is next?";
  }
}

type ChatRole = { role: "user" | "assistant"; content: string };

async function modeTurn(
  system: string,
  text: string,
  history: { role: string; content: string }[],
  deep: boolean,
): Promise<{ reply: string; corrections: CoachEnvelope["corrections"] }> {
  const raw = await aiJson<{ reply?: string; corrections?: { wrong?: string; right?: string; fa?: string; trap?: string }[] }>(
    system,
    [...(history.slice(-10) as ChatRole[]), { role: "user", content: text }],
    () => ({}),
    { deep },
  );
  return {
    reply: String(raw.reply ?? "").trim(),
    corrections: (Array.isArray(raw.corrections) ? raw.corrections.slice(0, 3) : []).map((c) => ({
      wrong: String(c.wrong ?? ""),
      right: String(c.right ?? ""),
      fa: String(c.fa ?? ""),
      trap: String(c.trap ?? "none"),
    })),
  };
}

async function roleplayTurn(
  text: string,
  data: ModeData,
  p: ProfileJson,
  steps: StepTrace[],
  history: { role: string; content: string }[],
  emit: (l: string, d?: string) => void,
): Promise<CoachEnvelope> {
  emit("In the scene", data.scene ?? "");
  const system = `You are the roleplay partner inside Rah for a Farsi speaker around ${p.level}. Stay fully in character.

SCENE: ${data.scene ?? "casual conversation"}
YOUR ROLE: ${data.partner ?? "conversation partner"}
THE LEARNER'S GOAL: ${data.goal ?? "communicate naturally in English"}

Rules:
- reply: stay in character, 1 to 3 sentences, push the scene forward with a question or complication. Natural spoken register.
- corrections: up to 2 per turn for real production errors, each with a Farsi "fa" explanation and a "trap" tag (statives, articles, countability, plurals, copula, prepositions, perfect, question_order, adjectives, that_omission, word_choice, register).
- Do not break character to teach. The corrections array is the teaching; the reply stays in the scene.
- No Farsi in the reply field. Never use the em dash character.`;
  const turn = await modeTurn(system, text, history, false);
  return envelope("roleplay", turn.reply || "...", steps, turn.corrections);
}

async function debateTurn(
  text: string,
  data: ModeData,
  p: ProfileJson,
  steps: StepTrace[],
  history: { role: string; content: string }[],
  emit: (l: string, d?: string) => void,
): Promise<CoachEnvelope> {
  const round = (data.round ?? 1) + (history.length % 2 === 0 ? 1 : 0);
  emit("Round", `${data.round ?? 1}: ${data.topic ?? ""}`);
  const system = `You are the debate opponent inside Rah for a Farsi speaker around ${p.level}.

TOPIC: ${data.topic ?? "a controversial everyday question"}
YOUR POSITION (argue it firmly): ${data.side ?? "the opposite of the learner"}

Rules:
- reply: 2 to 4 sentences. Rebut their last argument directly, add ONE new point for your side, and end pressing them to answer your strongest challenge. Sharp but respectful register.
- corrections: up to 2 real language errors from their message, each with Farsi "fa" and a "trap" tag.
- After round 3 the debate auto-ends with a scored verdict; until then never score, just argue.
- No Farsi in reply. Never use the em dash character.`;
  const turn = await modeTurn(system, text, history, false);
  await db.learner.update({ where: { id: "me" }, data: { modeData: JSON.stringify({ ...data, round }) } });
  if (round >= 3) {
    emit("Final round done", "scoring");
    const verdict = await aiJson<{ reply?: string }>(
      `You are the debate judge inside Rah (English coach for a Farsi speaker around ${p.level}). The 3-round debate on "${data.topic ?? "the topic"}" just ended. Write the verdict: their strongest moment, their weakest argument, 2 language upgrades they should steal, each in one short sentence. English only, no questions, no JSON.`,
      [{ role: "user", content: "verdict now" }],
      () => ({}),
      { deep: false, temperature: 0.4 },
    );
    await clearMode("debate finished");
    return envelope("debate", `${turn.reply || "..."}\n\nFINAL VERDICT: ${String(verdict.reply ?? "").trim()}\n\n(Back in coach mode.)`, [...steps, { label: "Verdict" }], turn.corrections);
  }
  return envelope("debate", turn.reply || "...", steps, turn.corrections);
}

async function socraticTurn(
  text: string,
  data: ModeData,
  p: ProfileJson,
  steps: StepTrace[],
  history: { role: string; content: string }[],
  emit: (l: string, d?: string) => void,
): Promise<CoachEnvelope> {
  emit("Socratic turn", "no answers, only questions");
  const system = `You are Rah in SOCRATIC MODE for a Farsi speaker around ${p.level}: ${data.goal ?? "guide them to discover the rule themselves"}.

Hard rules:
- reply: NEVER state the target rule or give the corrected form directly. Respond only with guiding questions, minimal pairs, or a sentence for them to try. Max 60 words.
- If they produce language, ask the question that makes THEM spot the problem ("which article would a native drop here?").
- If they are stuck after two attempts, give the smallest possible hint: one example, no explanation.
- corrections: still correct real errors (max 2) with Farsi "fa" and a "trap" tag - the correction card is allowed to reveal; your spoken turn is not.
- No Farsi in reply. Never use the em dash character.`;
  const turn = await modeTurn(system, text, history, false);
  return envelope("socratic", turn.reply || "...", steps, turn.corrections);
}

async function dailyTurn(
  text: string,
  data: ModeData,
  p: ProfileJson,
  steps: StepTrace[],
  emit: (l: string, d?: string) => void,
): Promise<CoachEnvelope> {
  const item = data.item;
  if (!item) {
    await clearMode("daily without item");
    return envelope("daily-challenge", "The challenge got lost. Back in coach mode: ask for today's challenge again.", steps);
  }
  if (SKIP.test(text.trim())) {
    emit("Revealing", "skipped");
    await clearMode("skipped");
    return envelope("daily-challenge", `The answer was "${item.a}". ${item.why ?? ""} It stays in the mistake memory and will come back in a future exam. Back in coach mode.`, steps);
  }
  emit("Grading your answer", item.tag ? `hunting: ${item.tag}` : "");
  const correct = gradeAnswer({ given: text, type: item.type ?? "short", a: item.a, accept: item.accept, choices: item.choices });
  if (item.tag) await noteExamAnswer(item.tag, text, item.a, correct);
  await clearMode(correct ? "daily beaten" : "daily missed");
  return envelope(
    "daily-challenge",
    correct
      ? `Correct - "${item.a}" is exactly it. ${item.why ?? ""} Clean hit logged${item.tag ? ` against your ${item.tag} family` : ""}. Back in coach mode: tomorrow brings a fresh one.`
      : `Not this time: the answer is "${item.a}". ${item.why ?? ""} Logged${item.tag ? ` under your ${item.tag} family` : ""} - future exams will hunt it until you beat it twice. Back in coach mode.`,
    steps,
  );
}

// Daily challenge opener: deterministic pick from live data (weakest skill
// band + top active mistake family), one AI-built item, stored as pending.
export async function startDaily(p: ProfileJson, emit: (l: string, d?: string) => void): Promise<CoachEnvelope> {
  const steps: StepTrace[] = [{ label: "Building today's challenge", detail: "from your live weak spots" }];
  const topTag = p.mistakes[0]?.tag ?? "";
  const raw = await aiJson<{ q?: string; choices?: string[]; a?: string; accept?: string[]; why?: string; skill?: string }>(
    `You are the challenge builder inside Rah for a Farsi speaker around ${p.level}. Build exactly ONE hard but fair item that tests ${topTag ? `the "${topTag}" weakness (Farsi interference)` : `their weakest skill: ${p.weakSkills.join("/")}`}.
Shape: cloze (q contains ___), or short answer, or mcq with 4 choices. The answer must be objectively checkable.
Output ONE JSON object: {"q": "", "choices": ["", "", "", ""], "a": "", "accept": [], "why": "one English sentence, max 18 words", "skill": "grammar"}
No Farsi. Never use the em dash character.`,
    [{ role: "user", content: "build today's single challenge now" }],
    () => ({}),
    { deep: false, temperature: 0.8 },
  );
  const q = String(raw.q ?? "").trim();
  const a = String(raw.a ?? "").trim();
  if (!q || !a) return envelope("daily-challenge", "Could not build today's challenge - ask again in a minute.", steps);
  const item = {
    q,
    choices: Array.isArray(raw.choices) && raw.choices.length >= 2 ? raw.choices.map(String) : undefined,
    a,
    accept: Array.isArray(raw.accept) ? raw.accept.map(String).filter(Boolean) : [],
    why: String(raw.why ?? "").trim(),
    skill: String(raw.skill ?? "grammar"),
    type: Array.isArray(raw.choices) && raw.choices.length >= 2 ? "mcq" : "short",
    tag: topTag || undefined,
  };
  await db.learner.update({ where: { id: "me" }, data: { mode: "daily", modeData: JSON.stringify({ item, startedAt: Date.now() } satisfies ModeData) } });
  emit("Challenge live", item.tag ? `hunting: ${item.tag}` : item.skill);
  const choices = item.choices ? `\n${item.choices.map((c, i) => `   ${String.fromCharCode(97 + i)}) ${c}`).join("\n")}` : "";
  return envelope(
    "daily-challenge",
    `Today's challenge${item.tag ? ` (hunting your "${item.tag}" weak spot)` : ""}:\n\n${q}${choices}\n\nReply with your answer${item.choices ? " (a, b, c or d, or type it)" : ""}, "skip" to reveal, or "end" to bail. It grades instantly and feeds the mistake memory.`,
    steps,
  );
}
