// The Rah skill system. The coach is an agent that plans and executes these
// skills; the learner can also invoke any of them directly with /skill <id>.
// Every skill returns a SkillRun: a summary plus an optional payload the UI
// renders (interactive exam, level bands, theme patch, formatted card).

import { db } from "@/lib/db";
import { aiJson, aiText, type ProfileJson } from "@/lib/ai";
import { generateExam, type ExamSkill } from "@/lib/exam";

// ---------- shared types ----------

export interface BandRow {
  band: string; // grammar | vocabulary | writing | speaking | reading | listening | overall
  level: string; // A2 .. C1
  score: number; // 0 to 100
  evidence: string;
}

export interface ThemePatch {
  name: string;
  primary: string;
  primaryDeep: string;
  accent: string;
  rgb: string; // "r,g,b" of primary for shadows and washes
}

export type SkillPayload =
  | { type: "exam"; examId: string; title: string; minutes: number; skill: string; items: unknown[] }
  | { type: "bands"; title: string; bands: BandRow[]; deep: boolean }
  | { type: "theme"; patch: ThemePatch }
  | { type: "effect"; effect: string }
  | { type: "card"; title: string; body: string; reveal?: string };

export interface SkillRun {
  label: string; // short verb phrase shown in the agent trace, e.g. "Generated a 10-item exam"
  summary: string; // context handed to the reply synthesizer
  payload?: SkillPayload;
}

export interface SkillCtx {
  profile: ProfileJson;
  args: string; // everything after the skill id, trimmed
}

export interface Skill {
  id: string;
  name: string;
  blurb: string;
  keywords: string[];
  argHint?: string;
  run(args: string, ctx: SkillCtx): Promise<SkillRun>;
}

// ---------- settings helpers ----------

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

// ---------- theme presets (plugin: appearance) ----------

export const THEME_PRESETS: Record<string, ThemePatch> = {
  midnight: { name: "midnight", primary: "#4e8cff", primaryDeep: "#2650a3", accent: "#9dc0ff", rgb: "78,140,255" },
  emerald: { name: "emerald", primary: "#2fc273", primaryDeep: "#1d8f52", accent: "#8ff0bd", rgb: "47,194,115" },
  sunset: { name: "sunset", primary: "#ff8a4e", primaryDeep: "#c25a24", accent: "#ffc39d", rgb: "255,138,78" },
  violet: { name: "violet", primary: "#9b7bff", primaryDeep: "#6a48c9", accent: "#cbbaff", rgb: "155,123,255" },
  ocean: { name: "ocean", primary: "#38bdf8", primaryDeep: "#0b7fb3", accent: "#a5e8ff", rgb: "56,189,248" },
  rose: { name: "rose", primary: "#fb6f92", primaryDeep: "#c24767", accent: "#ffb3c6", rgb: "251,111,146" },
  gold: { name: "gold", primary: "#f59e0b", primaryDeep: "#b47307", accent: "#fcd34d", rgb: "245,158,11" },
};

function hexToRgb(hex: string): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return "";
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function shade(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  if (Number.isNaN(n) || v.length !== 6) return "";
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * f)));
  return `#${[ch(16), ch(8), ch(0)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function parseThemeArg(arg: string): ThemePatch | null {
  const a = arg.trim().toLowerCase();
  if (!a) return null;
  if (THEME_PRESETS[a]) return THEME_PRESETS[a];
  const hex = a.startsWith("#") ? a : `#${a}`;
  if (/^#[0-9a-f]{6}$/.test(hex) || /^#[0-9a-f]{3}$/.test(hex)) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    return { name: `custom ${hex}`, primary: hex, primaryDeep: shade(hex, 0.55), accent: shade(hex, 1.35), rgb };
  }
  for (const [key, patch] of Object.entries(THEME_PRESETS)) {
    if (a.includes(key)) return patch;
  }
  return null;
}

// ---------- level bands (per-skill assessment) ----------

const BANDS = ["grammar", "vocabulary", "writing", "speaking", "reading", "listening"] as const;

function levelFromScore(s: number): string {
  if (s >= 88) return "C1";
  if (s >= 76) return "B2+";
  if (s >= 60) return "B2";
  if (s >= 45) return "B1+";
  if (s >= 30) return "B1";
  return "A2";
}

async function persistBands(bands: BandRow[]): Promise<void> {
  for (const b of bands) {
    await db.skillLevel.upsert({
      where: { band: b.band },
      create: { band: b.band, level: b.level, score: b.score, evidence: JSON.stringify([b.evidence]) },
      update: { level: b.level, score: b.score, evidence: JSON.stringify([b.evidence]) },
    });
  }
}

// Learner evidence digest: real data from the app, not invented numbers.
async function buildDigest(): Promise<string> {
  const l = await db.learner.findUnique({ where: { id: "me" } });
  const [writes, speaks, corrections, stats, states] = await Promise.all([
    db.writingSub.findMany({ orderBy: { id: "desc" }, take: 4 }),
    db.speakSession.findMany({ orderBy: { id: "desc" }, take: 3 }),
    db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 12 }),
    db.dailyStat.findMany({ orderBy: { day: "desc" }, take: 14 }),
    db.cardState.findMany(),
  ]);
  const totalReps = states.reduce((a, s) => a + s.reps, 0);
  const totalLapses = states.reduce((a, s) => a + s.lapses, 0);
  const days = stats.length;
  const xp = stats.reduce((a, s) => a + s.xp, 0);
  const parts = [
    l ? `Placement level: ${l.level}. Streak: ${l.streak} days. Days active (last 2 weeks): ${days}. XP in that window: ${xp}.` : "",
    `Card deck: ${states.length} cards touched, ${totalReps} reviews, ${totalLapses} lapses (${totalReps ? Math.round((totalLapses / totalReps) * 100) : 0}% lapse rate).`,
    writes.length
      ? `Recent writing samples (newest first):\n${writes.map((w) => `- prompt: ${w.prompt.slice(0, 90)} | essay: ${w.text.slice(0, 700)} | previous grading: ${w.result.slice(0, 400)}`).join("\n")}`
      : "No writing samples yet.",
    speaks.length
      ? `Recent speaking transcripts:\n${speaks.map((s) => `- ${s.transcript.slice(0, 600)} | previous grading: ${s.result.slice(0, 300)}`).join("\n")}`
      : "No speaking sessions yet.",
    corrections.length
      ? `Recent coach correction envelopes (they contain the learner's recurring errors):\n${corrections.map((c) => c.content.slice(0, 350)).join("\n")}`
      : "No chat corrections yet.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

interface BandsRaw {
  bands: { band: string; score: number; evidence: string }[];
  verdict?: string;
}

async function assessBands(deep: boolean, profile: ProfileJson, extra?: string): Promise<{ bands: BandRow[]; verdict: string }> {
  const digest = await buildDigest();
  const sys = `You are the assessment engine of Rah, an English app for Farsi speakers. You assign a CEFR band per skill, based ONLY on the evidence provided. Do not invent performance that the evidence does not show; where evidence is missing, score conservatively around the placement level and say so in the evidence.

Skills to band: grammar, vocabulary, writing, speaking, reading, listening. Then compute "overall" as your best judgment of the learner's working level across all skills (not a plain average: weight productive skills at B2-to-C1 goal higher).
Score each 0 to 100 on a scale where 60 = solid B2, 76 = B2+, 88 = C1. Evidence is ONE English sentence citing the actual signal you used (a mistake pattern, a writing trait, absence of data).
Never use the em dash character.

Output ONE JSON object, nothing else:
{"bands": [{"band": "grammar", "score": 0, "evidence": ""}], "verdict": "two English sentences"}`;

  const user = `Learner profile: ${JSON.stringify(profile)}
${extra ? `Extra probe result: ${extra}` : ""}
Evidence digest:
${digest}`;

  const raw0 = await aiJson<BandsRaw>(sys, [{ role: "user", content: user }], undefined, { think: deep });
  // Deep pass: a second, adversarial verifier reviews and revises every band.
  let raw = raw0;
  if (deep) {
    try {
      raw = await aiJson<BandsRaw>(
        `You are the verification pass of the Rah assessment engine. A first pass produced these bands. Review them against the same evidence: challenge any score that looks inflated or unfairly low, sharpen the evidence lines to cite the concrete signal, and return the FINAL bands. Same scale (60 = solid B2, 76 = B2+, 88 = C1). Keep the same JSON shape, all seven bands present.
Output ONE JSON object, nothing else:
{"bands": [{"band": "grammar", "score": 0, "evidence": ""}], "verdict": "two English sentences"}
Never use the em dash character.`,
        [
          { role: "user", content: user },
          { role: "assistant", content: JSON.stringify(raw0) },
          { role: "user", content: "Verify and return the final bands." },
        ],
        undefined,
        { think: true },
      );
    } catch {
      raw = raw0; // verifier failed; first pass stands
    }
  }
  const rows = (raw.bands ?? [])
    .filter((b) => b && typeof b.band === "string")
    .map((b) => {
      const score = Math.max(0, Math.min(100, Math.round(Number(b.score) || 0)));
      const band = (BANDS as readonly string[]).includes(b.band) ? b.band : b.band.toLowerCase();
      return { band, level: levelFromScore(score), score, evidence: String(b.evidence ?? "").slice(0, 220) };
    });
  const known = rows.filter((r) => (BANDS as readonly string[]).includes(r.band) || r.band === "overall");
  if (!known.find((r) => r.band === "overall")) {
    const avg = known.length ? Math.round(known.reduce((a, r) => a + r.score, 0) / known.length) : 55;
    known.push({ band: "overall", level: levelFromScore(avg), score: avg, evidence: "Derived from the per-skill scores above." });
  }
  await persistBands(known);
  return { bands: known, verdict: String(raw.verdict ?? "").trim() };
}

// ---------- drills ----------

async function drill(skill: ExamSkill, ctx: SkillCtx, label: string): Promise<SkillRun> {
  const spec = await generateExam({ skill, count: 5, kind: "quick", profile: ctx.profile });
  const created = await db.exam.create({
    data: { kind: "quick", skill, level: spec.level, spec: JSON.stringify(spec), status: "open" },
  });
  spec.id = created.id;
  await db.exam.update({ where: { id: created.id }, data: { spec: JSON.stringify(spec) } });
  return {
    label,
    summary: `A 5-item ${skill} drill (id ${created.id}) is ready inline. Items use mixed kinds; grading is synonym-aware.`,
    payload: { type: "exam", examId: created.id, title: spec.title, minutes: spec.minutes, skill, items: toPublic(spec) },
  };
}

function toPublic(spec: { items: { id: string; skill: string; kind: string; prompt: string; choices?: string[]; hint: string }[] }) {
  return spec.items.map((it) => ({ id: it.id, skill: it.skill, kind: it.kind, prompt: it.prompt, choices: it.choices, hint: it.hint }));
}

// ---------- the registry ----------

export const SKILLS: Skill[] = [
  {
    id: "exam.generate",
    name: "Exam generator",
    blurb: "Full 10-item exam on any skill, graded with synonym-aware matching.",
    keywords: ["exam", "test", "quiz me", "assessment exam"],
    argHint: "collocations | grammar | vocabulary | spelling | mixed",
    async run(args, ctx) {
      const a = args.toLowerCase();
      const skill: ExamSkill = /collocation/.test(a) ? "collocation" : /grammar|tense/.test(a) ? "grammar" : /vocab|word/.test(a) ? "vocabulary" : /spell/.test(a) ? "spelling" : /read/.test(a) ? "reading" : /listen/.test(a) ? "listening" : /writ/.test(a) ? "writing" : "mixed";
      const spec = await generateExam({ skill, count: 10, kind: "standard", profile: ctx.profile });
      const created = await db.exam.create({
        data: { kind: "standard", skill, level: spec.level, spec: JSON.stringify(spec), status: "open" },
      });
      spec.id = created.id;
      await db.exam.update({ where: { id: created.id }, data: { spec: JSON.stringify(spec) } });
      return {
        label: `Generated a 10-item ${skill} exam`,
        summary: `A full 10-item exam (id ${created.id}, skill: ${skill}, about ${spec.minutes} minutes) is attached and renders inline. Announce exactly 10 items and ${spec.minutes} minutes, never any other count. The learner answers inline; grading is synonym-aware.`,
        payload: { type: "exam", examId: created.id, title: spec.title, minutes: spec.minutes, skill, items: toPublic(spec) },
      };
    },
  },
  {
    id: "exam.quick",
    name: "Quick check",
    blurb: "5-item rapid check when there is no time for a full exam.",
    keywords: ["quick", "fast test", "5 questions"],
    async run(args, ctx) {
      const a = args.toLowerCase();
      const skill: ExamSkill = /collocation/.test(a) ? "collocation" : /grammar/.test(a) ? "grammar" : /vocab|word/.test(a) ? "vocabulary" : "mixed";
      return drill(skill, ctx, `Generated a 5-item ${skill} quick check`);
    },
  },
  {
    id: "grammar.drill",
    name: "Grammar drill",
    blurb: "Targeted 5-item grammar drill tuned to your level and traps.",
    keywords: ["grammar drill", "drill my grammar", "grammar practice"],
    async run(_args, ctx) {
      return drill("grammar", ctx, "Generated a grammar drill");
    },
  },
  {
    id: "collocation.drill",
    name: "Collocation drill",
    blurb: "Verb-noun pairs that do not map from Farsi.",
    keywords: ["collocation", "word pairs", "make vs do"],
    async run(_args, ctx) {
      return drill("collocation", ctx, "Generated a collocation drill");
    },
  },
  {
    id: "vocabulary.drill",
    name: "Vocabulary drill",
    blurb: "B2-to-C1 word work in context.",
    keywords: ["vocabulary drill", "words drill", "vocab practice"],
    async run(_args, ctx) {
      return drill("vocabulary", ctx, "Generated a vocabulary drill");
    },
  },
  {
    id: "spelling.drill",
    name: "Spelling drill",
    blurb: "Common spelling traps for Farsi speakers.",
    keywords: ["spelling", "spell better", "orthography"],
    async run(_args, ctx) {
      return drill("spelling", ctx, "Generated a spelling drill");
    },
  },
  {
    id: "level.deep",
    name: "Deep level analysis",
    blurb: "Multi-pass analysis of your real work; takes about half a minute.",
    keywords: ["deep analysis", "analyze my level", "deep analyse", "what is my level"],
    async run(_args, ctx) {
      const { bands, verdict } = await assessBands(true, ctx.profile);
      return {
        label: "Ran a deep multi-pass level analysis",
        summary: `Deep analysis finished. Verdict for the reply: "${verdict}". Per-skill bands are attached and render as cards. Give the headline levels (overall plus the strongest and weakest skill) and one concrete next step.`,
        payload: { type: "bands", title: "Deep level analysis", bands, deep: true },
      };
    },
  },
  {
    id: "level.assess",
    name: "Skill assessment",
    blurb: "Per-skill CEFR bands: grammar, vocabulary, writing, speaking, reading, listening, plus overall.",
    keywords: ["assess", "my levels", "per skill", "which level"],
    async run(_args, ctx) {
      const { bands, verdict } = await assessBands(false, ctx.profile);
      return {
        label: "Assessed every skill separately",
        summary: `Assessment finished. Verdict: "${verdict}". Per-skill bands are attached. Mention that each skill is banded separately and give the overall.`,
        payload: { type: "bands", title: "Per-skill assessment", bands, deep: false },
      };
    },
  },
  {
    id: "reading.quiz",
    name: "Reading quiz",
    blurb: "Paste a text (or give a topic) and get a comprehension quiz.",
    keywords: ["reading quiz", "comprehension", "quiz this text"],
    argHint: "paste a text or name a topic",
    async run(args, ctx) {
      const src = args || "an everyday B2 topic of your choice";
      const raw = await aiJson<{ title: string; passage: string; questions: { q: string; a: string; why: string }[] }>(
        `You build reading comprehension inside Rah for a ${ctx.profile.level} Farsi speaker. Take the source text or topic and produce: a short title, the passage (or an excerpt if a text was pasted, 120 to 180 words), and 4 questions (two literal, two inferential). Each has the answer and a one-line why. English only. Never use the em dash character.
Output ONE JSON object: {"title": "", "passage": "", "questions": [{"q": "", "a": "", "why": ""}]}`,
        [{ role: "user", content: src.slice(0, 4000) }],
      );
      const body = `${raw.passage}\n\n${(raw.questions ?? []).map((q, i) => `${i + 1}. ${q.q}`).join("\n")}`;
      const reveal = (raw.questions ?? []).map((q, i) => `${i + 1}. ${q.a} (${q.why})`).join("\n");
      return {
        label: "Built a reading quiz",
        summary: "Reading passage plus 4 questions are attached. Invite the learner to answer in chat and offer to check each one.",
        payload: { type: "card", title: String(raw.title ?? "Reading quiz"), body, reveal },
      };
    },
  },
  {
    id: "listening.drill",
    name: "Listening drill",
    blurb: "Fresh graded monologue with comprehension questions.",
    keywords: ["listening", "monologue", "ear training"],
    async run(_args, ctx) {
      const raw = await aiJson<{ title: string; text: string; questions: { q: string; choices: string[]; a: string; why: string }[] }>(
        `You write listening material for a ${ctx.profile.level} Farsi speaker. ONE natural spoken-style monologue, 160 to 220 words, contractions used. Then 4 mcq comprehension questions (two literal, two inferential). English only. Never use the em dash character.
Output ONE JSON object: {"title": "", "text": "", "questions": [{"q": "", "choices": ["","","",""], "a": "exact correct choice", "why": ""}]}`,
        [{ role: "user", content: "Pick a fresh, useful everyday topic this time." }],
      );
      const body = `${raw.text}\n\n${(raw.questions ?? []).map((q, i) => `${i + 1}. ${q.q}\n${(q.choices ?? []).map((c) => `   ${c}`).join("\n")}`).join("\n")}`;
      const reveal = (raw.questions ?? []).map((q, i) => `${i + 1}. ${q.a} (${q.why})`).join("\n");
      return {
        label: "Generated a listening drill",
        summary: "Monologue plus 4 multiple-choice questions are attached, answers hidden until revealed. Tell the learner to read aloud slowly once, then answer.",
        payload: { type: "card", title: String(raw.title ?? "Listening drill"), body, reveal },
      };
    },
  },
  {
    id: "speaking.drill",
    name: "Speaking drill",
    blurb: "A 2-minute speaking prompt with a round-2 constraint.",
    keywords: ["speaking", "speak practice", "talk for 2 minutes"],
    async run(_args, ctx) {
      const raw = await aiJson<{ prompt: string; angle: string; round2: string }>(
        `You design speaking tasks for a ${ctx.profile.level} Farsi speaker. Give ONE prompt (a question that produces opinion plus reasons), one angle to force development, and a round-2 constraint that makes the repeat harder (ban a common verb, demand a counterargument, require hedging). English only. Never use the em dash character.
Output ONE JSON object: {"prompt": "", "angle": "", "round2": ""}`,
        [{ role: "user", content: "New topic, not food or family." }],
      );
      return {
        label: "Designed a speaking task",
        summary: "Speaking prompt attached. Tell the learner to record in the Speaking tab or answer in chat, then you will grade the transcript.",
        payload: { type: "card", title: "2-minute speaking task", body: `Prompt: ${raw.prompt}\nDevelop: ${raw.angle}\nRound 2 constraint: ${raw.round2}` },
      };
    },
  },
  {
    id: "writing.task",
    name: "Writing task",
    blurb: "A B2-to-C1 essay prompt with clear requirements.",
    keywords: ["writing task", "essay prompt", "give me a writing"],
    async run(_args, ctx) {
      const raw = await aiJson<{ prompt: string; requirements: string[] }>(
        `You set writing tasks for a ${ctx.profile.level} Farsi speaker. ONE prompt with 3 concrete requirements (structure, target structures to use, register). English only. Never use the em dash character.
Output ONE JSON object: {"prompt": "", "requirements": ["", "", ""]}`,
        [{ role: "user", content: "A fresh C1-flavored task." }],
      );
      return {
        label: "Set a writing task",
        summary: "Writing task attached. Point the learner to the Writing tab for full grading, or accept a draft in chat.",
        payload: { type: "card", title: "Writing task", body: `${raw.prompt}\nRequirements:\n${(raw.requirements ?? []).map((r) => `- ${r}`).join("\n")}` },
      };
    },
  },
  {
    id: "translation.drill",
    name: "Translation drill",
    blurb: "Farsi sentences to render in natural English.",
    keywords: ["translation", "translate drill", "farsi to english"],
    async run(_args, ctx) {
      const raw = await aiJson<{ items: { fa: string; en: string; note: string }[] }>(
        `You drill Farsi-to-English translation for a ${ctx.profile.level} learner. Produce 5 everyday-but-rich Farsi sentences (formal and informal mix) that expose classic interference: articles, countability, perfect tense, prepositions. Each with a natural English rendering and a one-line English note on the trap. Farsi appears only in the "fa" fields. Never use the em dash character.
Output ONE JSON object: {"items": [{"fa": "", "en": "", "note": ""}]}`,
        [{ role: "user", content: "Generate the 5 sentences." }],
      );
      const body = (raw.items ?? []).map((it, i) => `${i + 1}. ${it.fa}`).join("\n");
      const reveal = (raw.items ?? []).map((it, i) => `${i + 1}. ${it.en} (${it.note})`).join("\n");
      return {
        label: "Built a translation drill",
        summary: "5 Farsi sentences attached, model answers hidden. Ask the learner to translate in chat; grade each against the model plus fair variants.",
        payload: { type: "card", title: "Translate to English", body, reveal },
      };
    },
  },
  {
    id: "roleplay",
    name: "Roleplay",
    blurb: "Live scenario: job interview, airport, debate, you name it.",
    keywords: ["roleplay", "scenario", "pretend"],
    argHint: "scenario",
    async run(args, ctx) {
      const scene = args || "a job interview for a position you want";
      const setup = await aiText(
        `You set up roleplay inside Rah for a ${ctx.profile.level} Farsi speaker. Write a 3 to 4 sentence setup in English: the scene, your role, the learner's role, and your opening line in character. English only, no meta commentary, never use the em dash character.`,
        [{ role: "user", content: `Scenario: ${scene}` }],
      );
      return {
        label: `Started a roleplay (${scene.slice(0, 30)})`,
        summary: `Roleplay is set up. Stay in character in following turns until the learner exits the scenario.`,
        payload: { type: "card", title: "Roleplay", body: setup },
      };
    },
  },
  {
    id: "explain.error",
    name: "Error anatomy",
    blurb: "Paste a sentence; get every problem named and explained.",
    keywords: ["what is wrong", "explain the error", "anatomy", "check this sentence"],
    argHint: "the sentence",
    async run(args, ctx) {
      const s = args || ctx.args;
      if (!s.trim()) throw new Error("Give me the sentence to dissect.");
      const raw = await aiJson<{ errors: { wrong: string; right: string; fa: string; trap: string }[]; verdict: string }>(
        `You dissect one English sentence written by a ${ctx.profile.level} Farsi speaker. List EVERY real problem (grammar, word choice, collocation, register, punctuation); do not invent problems. For each: wrong, right, a Farsi explanation of why Farsi speakers make this mistake, and a trap tag. Then a one-sentence English verdict. Farsi only inside "fa". Never use the em dash character.
Output ONE JSON object: {"errors": [{"wrong": "", "right": "", "fa": "", "trap": ""}], "verdict": ""}`,
        [{ role: "user", content: s.slice(0, 600) }],
      );
      const body = raw.verdict || "Dissected.";
      return {
        label: "Dissected a sentence",
        summary: `Error anatomy done: ${(raw.errors ?? []).length} issues found. Repeat the corrections in your reply's corrections field (same wrong/right/fa), and the verdict as commentary.`,
        payload: { type: "card", title: "Error anatomy", body },
      };
    },
  },
  {
    id: "word.lookup",
    name: "Word lookup",
    blurb: "Meaning, register, collocations, Farsi sense, one example.",
    keywords: ["what does", "lookup", "meaning of", "how to use"],
    argHint: "word or phrase",
    async run(args, ctx) {
      const w = args.trim();
      if (!w) throw new Error("Name the word or phrase.");
      const raw = await aiJson<{ meaning: string; register: string; collocations: string[]; fa: string; example: string }>(
        `You are the dictionary card of Rah for a ${ctx.profile.level} Farsi speaker. For the given word or phrase: meaning (one English line), register (formal, neutral, informal, vulgar), 4 real collocations, the Farsi sense distinction (what Farsi word it maps to and where that mapping breaks), and one natural example sentence. Never use the em dash character.
Output ONE JSON object: {"meaning": "", "register": "", "collocations": ["", "", "", ""], "fa": "", "example": ""}`,
        [{ role: "user", content: w }],
      );
      const body = [
        String(raw.meaning ?? ""),
        `Register: ${raw.register ?? "neutral"}`,
        `Collocations: ${(raw.collocations ?? []).join(", ")}`,
        String(raw.example ?? ""),
      ].join("\n");
      return {
        label: `Looked up "${w.slice(0, 24)}"`,
        summary: "Word card attached. Farsi sense note is inside the card.",
        payload: { type: "card", title: w, body },
      };
    },
  },
  {
    id: "study.plan",
    name: "Study plan",
    blurb: "A concrete 7-day plan from your real weak spots.",
    keywords: ["study plan", "plan for me", "what should i study"],
    async run(_args, ctx) {
      const plan = await aiText(
        `You plan study weeks inside Rah for a ${ctx.profile.level} Farsi speaker. Using the live profile given by the user, write a 7-day plan in English. Each day: one line, one primary focus (pull from the learner's actual weak skills), one concrete output (10 cards, 5-minute monologue, 120-word essay, and so on). Max 120 words total. No preamble, no closing fluff, never use the em dash character.`,
        [{ role: "user", content: JSON.stringify(ctx.profile) }],
      );
      return {
        label: "Drafted a 7-day plan",
        summary: "Plan attached. Ask which day to start today.",
        payload: { type: "card", title: "Your next 7 days", body: plan },
      };
    },
  },
  {
    id: "progress.report",
    name: "Progress report",
    blurb: "What the numbers say: volume, accuracy, leaks, level movement.",
    keywords: ["progress report", "how am i doing", "my stats"],
    async run(_args, ctx) {
      const stats = await db.dailyStat.findMany({ orderBy: { day: "asc" }, take: 30 });
      const xp = stats.reduce((a, s) => a + s.xp, 0);
      const reviews = stats.reduce((a, s) => a + s.reviews, 0);
      const correct = stats.reduce((a, s) => a + s.correct, 0);
      const l = await db.learner.findUnique({ where: { id: "me" } });
      const bands = await db.skillLevel.findMany();
      const facts = {
        level: l?.level ?? "?",
        streak: l?.streak ?? 0,
        activeDays: stats.filter((s) => s.reviews > 0).length,
        xp30: xp,
        reviews30: reviews,
        accuracy: reviews ? Math.round((correct / reviews) * 100) : null,
        bands: bands.map((b) => ({ band: b.band, level: b.level, score: Math.round(b.score) })),
      };
      const report = await aiText(
        `You write progress reports inside Rah for a ${ctx.profile.level} Farsi speaker. From the JSON facts, write max 110 words in English: two things that are clearly working, one leak to fix, one sentence on level movement (or that bands are not yet measured). No headers, no bullet points, plain tight prose. Never use the em dash character.`,
        [{ role: "user", content: JSON.stringify(facts) }],
      );
      return {
        label: "Compiled a progress report",
        summary: "Report attached, built from real app data.",
        payload: { type: "card", title: "Progress report", body: report },
      };
    },
  },
  {
    id: "review.tune",
    name: "Schedule tuning",
    blurb: "Adjust daily new cards, daily goal, or target retention.",
    keywords: ["schedule", "new cards per day", "retention", "daily goal"],
    argHint: "e.g. 15 new per day, or retention 0.92",
    async run(args) {
      const a = args.toLowerCase();
      const l = await db.learner.findUnique({ where: { id: "me" } });
      if (!l) throw new Error("Learner row missing.");
      const data: Record<string, number> = {};
      const nNew = a.match(/(\d+)\s*(new|cards)/);
      if (nNew) data.newPerDay = Math.max(3, Math.min(50, parseInt(nNew[1], 10)));
      const nGoal = a.match(/goal\s*(\d+)|(\d+)\s*(minutes|min\b)/);
      if (nGoal) data.dailyGoal = Math.max(5, Math.min(180, parseInt(nGoal[1] || nGoal[2], 10)));
      const nRet = a.match(/retention\s*([\d.]+)/);
      if (nRet) data.retention = Math.max(0.7, Math.min(0.97, parseFloat(nRet[1])));
      if (Object.keys(data).length === 0) {
        return {
          label: "Explained schedule tuning",
          summary: "The request did not parse. Tell the learner the accepted forms: a number plus new, goal N, retention 0.9.",
          payload: { type: "card", title: "Schedule tuning", body: "Try: '15 new per day', 'daily goal 30', or 'retention 0.92'." },
        };
      }
      await db.learner.update({ where: { id: "me" }, data });
      return {
        label: "Retuned the review schedule",
        summary: `Schedule updated: ${JSON.stringify(data)}. Confirm in one sentence what changed and why it helps.`,
      };
    },
  },
  {
    id: "theme.set",
    name: "Theme plugin",
    blurb: "Recolor the whole app live: presets or any hex color.",
    keywords: ["change color", "theme", "dark blue", "make it", "recolor"],
    argHint: "emerald | sunset | violet | ocean | rose | gold | midnight | #hex",
    async run(args) {
      const patch = parseThemeArg(args);
      if (!patch) {
        return {
          label: "Listed theme options",
          summary: "Theme argument did not parse. Offer the presets and the hex form.",
          payload: { type: "card", title: "Theme plugin", body: `Presets: ${Object.keys(THEME_PRESETS).join(", ")}. Or any hex like #7c5cff.` },
        };
      }
      await setSetting("theme", JSON.stringify(patch));
      return {
        label: `Recolored the app (${patch.name})`,
        summary: `Theme "${patch.name}" is applied live to the whole UI. Confirm it in one casual sentence.`,
        payload: { type: "theme", patch },
      };
    },
  },
  {
    id: "theme.reset",
    name: "Theme reset",
    blurb: "Back to the default midnight look.",
    keywords: ["reset theme", "default color", "normal colors"],
    async run() {
      const patch = THEME_PRESETS.midnight;
      await setSetting("theme", JSON.stringify(patch));
      return {
        label: "Reset the theme to midnight",
        summary: "Default theme restored.",
        payload: { type: "theme", patch },
      };
    },
  },
  {
    id: "gui.effect",
    name: "GUI effect plugin",
    blurb: "Switch the WebGL backdrop: aurora, waves, particles, or none.",
    keywords: ["effect", "background", "webgl", "aurora", "waves", "particles"],
    argHint: "aurora | waves | particles | none",
    async run(args) {
      const a = args.trim().toLowerCase();
      const effect = /aurora|northern/.test(a) ? "aurora" : /wave/.test(a) ? "waves" : /particle|star|dot/.test(a) ? "particles" : /none|off|plain/.test(a) ? "none" : "";
      if (!effect) {
        return {
          label: "Listed GUI effects",
          summary: "Effect argument did not parse. Offer: aurora, waves, particles, none.",
          payload: { type: "card", title: "GUI effects", body: "Options: aurora, waves, particles, none. Example: /skill gui.effect waves" },
        };
      }
      await setSetting("effect", effect);
      return {
        label: `Switched the backdrop to ${effect}`,
        summary: `WebGL backdrop set to "${effect}". Confirm in one short sentence.`,
        payload: { type: "effect", effect },
      };
    },
  },
  {
    id: "memory.save",
    name: "Coach memory",
    blurb: "Save a preference or goal the coach should always remember.",
    keywords: ["remember", "keep in mind", "note that"],
    argHint: "the note",
    async run(args) {
      const note = args.trim();
      if (!note) throw new Error("Tell me what to remember.");
      const cur = JSON.parse((await getSetting("memory")) ?? "[]") as string[];
      const next = [...cur, note.slice(0, 200)].slice(-20);
      await setSetting("memory", JSON.stringify(next));
      return {
        label: "Saved to coach memory",
        summary: `Memory saved. Confirm briefly what you will now remember.`,
      };
    },
  },
  {
    id: "memory.show",
    name: "Show memory",
    blurb: "What the coach currently remembers about you.",
    keywords: ["what do you remember", "show memory"],
    async run() {
      const cur = JSON.parse((await getSetting("memory")) ?? "[]") as string[];
      return {
        label: "Recalled coach memory",
        summary: cur.length ? "List the remembered notes briefly." : "Memory is empty; invite the learner to save preferences with /skill memory.save.",
        payload: { type: "card", title: "Coach memory", body: cur.length ? cur.map((n, i) => `${i + 1}. ${n}`).join("\n") : "Nothing saved yet." },
      };
    },
  },
];

export function findSkill(idOrName: string): Skill | undefined {
  const q = idOrName.trim().toLowerCase().replace(/^\/+/, "").replace(/^skill\s+/, "");
  if (!q) return undefined;
  const direct =
    SKILLS.find((s) => s.id.toLowerCase() === q) ??
    SKILLS.find((s) => s.id.toLowerCase().replace(".", " ") === q) ??
    SKILLS.find((s) => s.id.toLowerCase().endsWith(`.${q}`)) ??
    SKILLS.find((s) => s.name.toLowerCase() === q);
  if (direct) return direct;
  // Fuzzy fallback: score skills by how many of the caller's words appear in
  // the id, name, or keywords, so "/skill generate exam" still lands on
  // exam.generate regardless of word order or extra filler.
  const tokens = q.split(/[^a-z0-9#]+/).filter((t) => t.length > 2 && t !== "skill" && t !== "generate" && t !== "make" && t !== "create" && t !== "build" && t !== "please" && t !== "want" && t !== "give" && t !== "show" && t !== "run" && t !== "start");
  const stop = new Set(["the", "and", "for", "with", "some", "that", "this", "about", "quick", "deep", "full", "new", "set", "reset"]);
  const scoreOf = (s: Skill) => {
    const hay = `${s.id} ${s.name} ${s.keywords.join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (!stop.has(t) && hay.includes(t)) score += 1;
    }
    return score;
  };
  let best: { s: Skill; score: number } | null = null;
  for (const s of SKILLS) {
    const score = scoreOf(s);
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best && best.score >= 1 ? best.s : undefined;
}

export function skillCatalog() {
  return SKILLS.map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, argHint: s.argHint ?? null }));
}
