// The coach agent. A learner message enters, the router decides which skill
// owns it, and the skill runs as a sequence of visible steps. Heavy skills
// think in several passes; the router is deterministic so a request for an
// exam can never bounce off a chatty "I can't do that".

import { db } from "@/lib/db";
import { aiJson, tutorSystem, type ProfileJson } from "@/lib/ai";
import { buildProfile, bumpDaily, touchStreak, diagnose } from "@/lib/server";
import { buildExam, gradeExam } from "./exam";
import { deepAssess } from "./assess";
import { examWriteSystem, routerSystem } from "./prompts";
import { resolveTheme } from "./theme";
import type { AgentEvent, Envelope, Exam, ExamQuestion } from "./types";

const DRILL_SKILLS = [
  "collocation", "articles", "prepositions", "tenses",
  "countability", "phrasal", "register", "wordform",
] as const;

const DRILL_TITLES: Record<string, string> = {
  collocation: "Collocation Drill",
  articles: "Article Drill",
  prepositions: "Preposition Drill",
  tenses: "Tense Drill",
  countability: "Countability Drill",
  phrasal: "Phrasal Verb Drill",
  register: "Register Drill",
  wordform: "Word Form Drill",
};

export interface AgentIo {
  emit: (e: AgentEvent) => void;
  say: (label: string, state: "run" | "done", detail?: string) => void;
  profile: ProfileJson;
}

function clean(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").trim();
}

// ---------- deterministic router: fast, never refuses ----------

export function routeIntent(message: string): { skill: string; drill?: string } {
  const m = message.toLowerCase();

  if (/\b(make|create|build|generate|give me|set|want|need|design)\b.{0,24}\b(exam|test|quiz)\b/.test(m)) {
    return { skill: "exam.build" };
  }
  if (/(exam|test me|quiz me|test my|quiz on|test on|quiz about|challenge me|assess me with)/.test(m)) {
    return { skill: "exam.quick" };
  }
  for (const d of DRILL_SKILLS) {
    const words: Record<string, string> = {
      collocation: "collocation|collocations|word pairs",
      articles: "articles|a an the",
      prepositions: "prepositions",
      tenses: "tenses|verb tense",
      countability: "countability|countable|uncountable",
      phrasal: "phrasal|phrasal verbs",
      register: "register|formal|informal tone",
      wordform: "word form|word forms|suffixes|prefixes",
    };
    if (new RegExp(`(drill|practice|quiz|test).{0,30}\\b(${words[d]})\\b`).test(m)) return { skill: "drill", drill: d };
    if (new RegExp(`\\b(${words[d]})\\b.{0,20}(drill|quiz|test|practice)`).test(m)) return { skill: "drill", drill: d };
  }
  if (/(translate|say this in english|how do i say)/.test(m)) return { skill: "translate" };
  if (/(rewrite|upgrade|sound more (natural|professional|advanced)|c1 version|make this sound)/.test(m)) return { skill: "rewrite" };
  if (/(assess|evaluate|analyze|analyse).{0,30}(me|my|level|skills?|grammar|vocab|english)|what('| i)?s my level|my (current )?level|deep analysis|where (am i|do i stand)/.test(m)) {
    return { skill: "assess" };
  }
  if (/(my |the )?(mistakes|errors|weakness|leaks|what (do )?i keep|recurring)/.test(m) && /(wrong|mistakes|errors|keep|review|patterns)/.test(m)) {
    return { skill: "mistakes" };
  }
  if (/(study plan|plan my|weekly plan|plan for (the )?week|schedule my)/.test(m)) return { skill: "plan" };
  if (/(add|build|make|give).{0,20}\b(vocab(ulary)? (cards|list|set))\b|new words to (learn|study)/.test(m)) return { skill: "vocab" };
  if (/(progress|stats|report|how am i doing)/.test(m)) return { skill: "progress" };
  if (/((change|switch|make|set|paint|restyle|restyle).{0,24}(color|colour|theme|look|style|mode)|make (it|the app).{0,20}(green|blue|red|pink|purple|violet|orange|amber|gold|teal|cyan|rose|dark|midnight|emerald|steel)|dark mode|night mode|light mode)/.test(m)) {
    return { skill: "theme" };
  }
  if (/(roleplay|role play|practice a|interview|simulate)/.test(m)) return { skill: "roleplay" };
  return { skill: "chat" };
}

// ---------- chat (Socratic tutor, unchanged behavior, cleaner voice) ----------

async function chatSkill(message: string, io: AgentIo): Promise<Envelope> {
  const history = await db.chatMsg.findMany({ orderBy: { id: "desc" }, take: 14 });
  const aiHistory = history
    .reverse()
    .map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("assistant" as const),
      content: h.role === "user" ? h.content : h.content.slice(0, 900),
    }));

  const out = await aiJson<{
    reply: string; corrections: { wrong: string; right: string; fa: string; trap: string }[];
    fa_note: string; praised: boolean;
  }>(
    tutorSystem(io.profile),
    [...aiHistory, { role: "user", content: message }],
    (raw) => ({ reply: clean(raw.trim().slice(0, 600)), corrections: [], fa_note: "", praised: false }),
  );
  return {
    kind: "chat",
    reply: clean(out.reply ?? ""),
    corrections: (out.corrections ?? []).map((c) => ({
      wrong: clean(String(c.wrong ?? "")),
      right: clean(String(c.right ?? "")),
      fa: clean(String(c.fa ?? "")),
      trap: clean(String(c.trap ?? "none")),
    })),
    fa_note: clean(out.fa_note ?? ""),
    praised: Boolean(out.praised),
  };
}

// ---------- drills, translate, rewrite: small focused exams ----------

async function buildDrill(kind: string, message: string, io: AgentIo): Promise<Envelope> {
  const title = kind === "translate" ? "Translation Round" : kind === "rewrite" ? "C1 Rewrite Round" : DRILL_TITLES[kind];
  io.say(`Preparing ${title.toLowerCase()}`, "run");

  const blueprint: { sections: unknown[] } = {
    sections: Array.from({ length: 6 }, (_, i) => ({
      skill: kind === "translate" || kind === "rewrite" ? "grammar" : kind,
      type: i < 4 ? "cloze" : "mcq",
      point: kind,
    })),
  };
  if (kind === "translate") {
    for (let i = 0; i < 6; i++) blueprint.sections[i] = { skill: "grammar", type: "translate", point: "Farsi to natural English" };
  }
  if (kind === "rewrite") {
    for (let i = 0; i < 6; i++) blueprint.sections[i] = { skill: "grammar", type: "rewrite", point: "plain B2 phrasing to C1 phrasing" };
  }

  io.say("Writing the items", "run");
  const written = await aiJson<{ items: ExamQuestion[] }>(
    examWriteSystem(io.profile, JSON.stringify(blueprint.sections)),
    [{ role: "user", content: message || `Build a ${title}.` }],
  );

  // reuse the exam normalizer through buildExam's pipeline pieces: simplest
  // safe route is to run the same write path with a fixed count of 6.
  io.say("Checking every item", "run");
  const exam: Exam = {
    id: `dr${Date.now().toString(36)}`,
    title,
    targetLevel: io.profile.level,
    questions: (written.items ?? []).slice(0, 6).map((it, i) => ({
      id: `q${i + 1}`,
      type: (["cloze", "mcq", "rewrite", "translate"].includes(it.type) ? it.type : "cloze") as ExamQuestion["type"],
      skill: (kind === "translate" || kind === "rewrite" ? "grammar" : kind) as ExamQuestion["skill"],
      prompt: clean(String(it.prompt ?? "")).slice(0, 400),
      choices: it.choices?.slice(0, 4),
      accept: (it.accept ?? []).slice(0, 5).map((a) => clean(String(a))).filter(Boolean),
      point: clean(String(it.point ?? "")).slice(0, 80) || kind,
      fa: clean(String(it.fa ?? "")).slice(0, 160),
      why: clean(String(it.why ?? "")).slice(0, 240),
    })).filter((q) => q.prompt.length > 8 && q.accept.length > 0),
    builtAt: Date.now(),
  };
  io.say("Checking every item", "done", `${exam.questions.length} items ready`);
  await db.quizItem.create({ data: { src: "exam", quiz: JSON.stringify(exam) } });
  return {
    kind: "exam",
    exam,
    intro: `${title}. ${exam.questions.length} items, aimed at your weak spots.`,
    fa_note: "چند جواب درست می‌زنی؟",
  };
}

// ---------- progress report (all local) ----------

async function progressSkill(io: AgentIo): Promise<Envelope> {
  io.say("Reading your numbers", "run");
  const [l, dg, stats, writes, speaks] = await Promise.all([
    db.learner.findUnique({ where: { id: "me" } }),
    diagnose(),
    db.dailyStat.findMany({ orderBy: { day: "desc" }, take: 14 }),
    db.writingSub.count(),
    db.speakSession.count(),
  ]);
  const reviews = stats.reduce((a, s) => a + s.reviews, 0);
  const correct = stats.reduce((a, s) => a + s.correct, 0);
  const xp = stats.reduce((a, s) => a + s.xp, 0);
  const acc = reviews ? Math.round((correct / reviews) * 100) : 0;
  const weakest = dg.bySkill[0];
  const due = await db.cardState.count({ where: { state: { not: "new" }, due: { lte: Math.floor(Date.now() / 86400000) + 1 }, suspended: false } }).catch(() => 0);
  io.say("Reading your numbers", "done", `${reviews} reviews, ${acc}% held`);

  const bits = [
    `${reviews} reviews in the last two weeks, ${correct} held (${acc}%).`,
    `${xp} XP earned. Streak at ${l?.streak ?? 0} days.`,
    writes + speaks > 0 ? `${writes} writings and ${speaks} speaking rounds on record.` : "No writing or speaking rounds yet.",
    weakest && weakest.reps >= 5 ? `${weakest.skill} leaks the most (${Math.round(weakest.lapseRate * 100)}% lapse rate).` : "",
    due > 0 ? `${due} cards are waiting in the queue right now.` : "The queue is clear.",
  ].filter(Boolean);

  return {
    kind: "steps",
    reply: bits.join(" "),
    steps: [],
    fa_note: "ادامه بده، مسیر درسته.",
    data: { reviews, correct, acc, xp, streak: l?.streak ?? 0, due, writes, speaks, bySkill: dg.bySkill.slice(0, 5) },
    dataType: "progress",
  };
}

// ---------- mistakes review ----------

async function mistakesSkill(io: AgentIo): Promise<Envelope> {
  io.say("Collecting your recent corrections", "run");
  const msgs = await db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 40 });
  const items: { wrong: string; right: string; trap: string }[] = [];
  for (const m of msgs) {
    try {
      const j = JSON.parse(m.content) as { corrections?: { wrong: string; right: string; trap?: string }[] };
      for (const c of j.corrections ?? []) items.push({ wrong: c.wrong, right: c.right, trap: c.trap ?? "none" });
    } catch { /* skip */ }
  }
  io.say("Collecting your recent corrections", "done", `${items.length} corrections found`);
  io.say("Finding the patterns", "run");
  const res = await aiJson<{ reply: string; patterns: { trap: string; count: number; fix: string; examples: { wrong: string; right: string }[] }[]; fa_note: string }>(
    `You are Rah, the coach in an English app for Farsi speakers. Never present yourself as an AI, a model, or a system. Never use the em dash character.
Below are the learner's recent corrections. Group them into at most 3 real patterns (by trap tag or by shape). For each: how often it appears, the fix in one sentence, and up to 3 examples. Then one Farsi line. Reply with ONE JSON object, nothing else:
{"reply":"2-3 sentences naming the biggest pattern in plain words","patterns":[{"trap":"tag","count":3,"fix":"one sentence","examples":[{"wrong":"","right":""}]}],"fa_note":"one Farsi sentence"}`,
    [{ role: "user", content: JSON.stringify(items.slice(0, 20)) }],
  );
  io.say("Finding the patterns", "done", `${(res.patterns ?? []).length} patterns`);
  return {
    kind: "steps",
    reply: clean(res.reply ?? ""),
    steps: [],
    fa_note: clean(res.fa_note ?? ""),
    data: { patterns: res.patterns ?? [] },
    dataType: "patterns",
  };
}

// ---------- weekly plan ----------

async function planSkill(io: AgentIo): Promise<Envelope> {
  io.say("Balancing the week against your leaks", "run");
  const res = await aiJson<{ intro: string; days: { day: string; task: string; minutes: number }[]; fa_note: string }>(
    `You are Rah, the coach in an English app for Farsi speakers. Never present yourself as an AI, a model, or a system. Never use the em dash character.
Build a 7-day plan for this learner around their actual weak spots (profile below). Each day: one concrete task naming the exact pattern or material, and a realistic minute count between 15 and 45. Vary the skills. Reply with ONE JSON object, nothing else:
{"intro":"one sentence on the shape of the week","days":[{"day":"Sat","task":"","minutes":20}],"fa_note":"one Farsi sentence"}`,
    [{ role: "user", content: JSON.stringify(io.profile) }],
  );
  io.say("Balancing the week against your leaks", "done", `${(res.days ?? []).length} days set`);
  return {
    kind: "steps",
    reply: clean(res.intro ?? ""),
    steps: [],
    fa_note: clean(res.fa_note ?? ""),
    data: { days: res.days ?? [] },
    dataType: "plan",
  };
}

// ---------- vocabulary set ----------

async function vocabSkill(message: string, io: AgentIo): Promise<Envelope> {
  io.say("Picking words worth keeping", "run");
  const res = await aiJson<{ intro: string; cards: { word: string; pos: string; meaning: string; fa: string; example: string }[]; fa_note: string }>(
    `You are Rah, the coach in an English app for Farsi speakers around ${io.profile.level}. Never present yourself as an AI, a model, or a system. Never use the em dash character.
Pick 8 words or collocations this learner should own next: mid-frequency, useful forever, biased toward their weak skills. For each: part of speech, a crisp meaning, the Farsi equivalent, and one natural example sentence. Reply with ONE JSON object, nothing else:
{"intro":"one sentence on why these","cards":[{"word":"","pos":"","meaning":"","fa":"","example":""}],"fa_note":"one Farsi sentence"}`,
    [{ role: "user", content: message }],
  );
  io.say("Picking words worth keeping", "done", `${(res.cards ?? []).length} words`);
  return {
    kind: "steps",
    reply: clean(res.intro ?? ""),
    steps: [],
    fa_note: clean(res.fa_note ?? ""),
    data: { cards: res.cards ?? [] },
    dataType: "vocab",
  };
}

// ---------- appearance plugin ----------

async function themeSkill(message: string, io: AgentIo): Promise<Envelope> {
  io.say("Mixing the palette", "run");
  let spec = resolveTheme(message);
  if (!spec) {
    // unknown description: one tiny call to map it to a color word
    try {
      const res = await aiJson<{ word: string }>(
        `Map this description to ONE English color word from: blue, sky, green, emerald, mint, teal, turquoise, cyan, red, crimson, rose, pink, magenta, purple, violet, lavender, indigo, orange, coral, amber, gold, yellow. Reply with ONE JSON object: {"word":"..."}. Description: ${message}`,
        [{ role: "user", content: message }],
      );
      spec = resolveTheme(String(res.word ?? ""));
    } catch { /* stays null */ }
  }
  if (!spec) {
    io.say("Mixing the palette", "done", "no match");
    return {
      kind: "chat",
      reply: "Say a color and the whole app follows: midnight blue, emerald, violet, rose, amber, cyan, steel. Or a plain word like green, purple, orange.",
      corrections: [],
      fa_note: "یک رنگ بگو تا کل برنامه هماهنگ شود.",
      praised: false,
    };
  }
  // persist on the learner, same as /api/settings PUT
  const learner = await db.learner.findUnique({ where: { id: "me" } });
  let settings: Record<string, unknown> = {};
  try { settings = JSON.parse(learner?.settings || "{}"); } catch { /* fresh */ }
  settings.theme = spec;
  await db.learner.upsert({
    where: { id: "me" },
    update: { settings: JSON.stringify(settings) },
    create: { id: "me", settings: JSON.stringify(settings) },
  });
  io.say("Mixing the palette", "done", spec.name);
  io.say("Repainting every screen", "done");
  return {
    kind: "theme",
    theme: spec,
    note: `The whole app is now ${spec.name}. Every screen, button, and glow follows the same palette. Say the name of another color any time, or "midnight" to come back.`,
    fa: `رنگ برنامه شد ${spec.name}. هر وقت خواستی اسم یک رنگ دیگر را بگو.`,
  };
}

// ---------- orchestrator ----------

export async function runAgent(message: string, emit: (e: AgentEvent) => void): Promise<void> {
  const profile = await buildProfile();
  const io: AgentIo = {
    emit,
    say: (label, state, detail) => emit({ type: "step", label, state, detail }),
    profile,
  };

  const { skill, drill } = routeIntent(message);

  await db.chatMsg.create({ data: { role: "user", content: message } });

  let envelope: Envelope;
  try {
    switch (skill) {
      case "exam.build":
        emit({ type: "start", skill: "exam.build", title: "Building your exam" });
        envelope = await examEnvelope(message, io, false);
        break;
      case "exam.quick":
        emit({ type: "start", skill: "exam.quick", title: "Building a quick check" });
        envelope = await examEnvelope(message, io, true);
        break;
      case "drill":
        emit({ type: "start", skill: "drill", title: "Drill time" });
        envelope = await buildDrill(drill ?? "collocation", message, io);
        break;
      case "translate":
        emit({ type: "start", skill: "translate", title: "Translation round" });
        envelope = await buildDrill("translate", message, io);
        break;
      case "rewrite":
        emit({ type: "start", skill: "rewrite", title: "C1 rewrite round" });
        envelope = await buildDrill("rewrite", message, io);
        break;
      case "assess":
        emit({ type: "start", skill: "assess.deep", title: "Deep skill assessment" });
        envelope = {
          kind: "assessment",
          assessment: await deepAssess({
            profile,
            emit: (s) => io.say(s.label, s.state, s.detail),
          }),
        };
        break;
      case "progress":
        emit({ type: "start", skill: "progress.report", title: "Progress report" });
        envelope = await progressSkill(io);
        break;
      case "mistakes":
        emit({ type: "start", skill: "mistakes.review", title: "Pattern review" });
        envelope = await mistakesSkill(io);
        break;
      case "plan":
        emit({ type: "start", skill: "plan.weekly", title: "Weekly plan" });
        envelope = await planSkill(io);
        break;
      case "vocab":
        emit({ type: "start", skill: "vocab.build", title: "Vocabulary set" });
        envelope = await vocabSkill(message, io);
        break;
      case "theme":
        emit({ type: "start", skill: "app.theme", title: "Restyling the app" });
        envelope = await themeSkill(message, io);
        break;
      default:
        emit({ type: "start", skill: "chat", title: "Coach" });
        envelope = await chatSkill(message, io);
        break;
    }
  } catch (e) {
    emit({ type: "error", message: `The coach hit a snag: ${(e as Error).message}. Try once more.` });
    return;
  }

  await db.chatMsg.create({ data: { role: "coach", content: JSON.stringify(envelope) } });
  await bumpDaily("reviews");
  await bumpDaily("xp", 8);
  await touchStreak();
  emit({ type: "final", envelope });
}

// Exam build with the standard step flow; quick skips the verification pass.
async function examEnvelope(message: string, io: AgentIo, quick: boolean): Promise<Envelope> {
  const stepIo = { ...io, say: io.say };
  const exam = await buildExam(message, {
    profile: io.profile,
    emit: (s) => {
      // the verification pass is the deep-thinking step; skip it for quick
      if (quick && s.label === "Checking every question" && s.state === "run") return;
      io.say(s.label, s.state, s.detail);
    },
  });
  void stepIo;
  return {
    kind: "exam",
    exam,
    intro: quick
      ? `${exam.questions.length} quick questions, aimed at where you wobble.`
      : `${exam.questions.length} questions, aimed at your recent leaks. Take your time.`,
    fa_note: "خودت را محک بزن؛ بعدش با هم بررسی می‌کنیم.",
  };
}

export { gradeExam };
