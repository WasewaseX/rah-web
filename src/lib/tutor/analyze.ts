// Report engine: the tutor's analytical skills. Every report starts from real
// app data (FSRS states, review logs, exam runs, writing, speaking, chat
// corrections), computes deterministic metrics, then either synthesizes with
// the LLM or falls back to a mechanical report. The numbers never lie even
// when the model fails.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import { dayIndex } from "@/lib/fsrs";
import { cardById } from "@/lib/content";
import type { DiagnosisReport, DeepLevelReport, ForecastReport, PlanReport, SkillBand } from "./types";

const TRAP_FA: Record<string, string> = {
  articles: "فارسی حرف تعریف ندارد، پس a/an/the برای تو نویز ذهنی است.",
  countability: "در فارسی اسم‌های غیرقابل‌شمارش مثل information جمع بسته می‌شوند، در انگلیسی نه.",
  plurals: "بعد از عدد در فارسی اسم مفرد می‌آید؛ انگلیسی جمع می‌خواهد: two books.",
  copula: "فارسی «است» را پسوند می‌گیرد؛ انگلیسی فعل be را حذف نمی‌کند: He is a teacher.",
  prepositions: "«در» فارسی هم in است هم at هم on؛ انگلیسی این سه را جدی جدا می‌کند.",
  statives: "«دارم می‌دانم» به انگلیسی نمی‌رود؛ فعل‌های حالتی استمراری نمی‌شوند.",
  perfect: "رفته‌ام فارسی با have gone انگلیسی یکی نیست؛ با زمان مشخص گذشته ساده لازم است.",
  question_order: "فارسی ترتیب پرسشی ندارد؛ انگلیسی Do you know where the station is می‌خواهد.",
  adjectives: "فارسی صفت را بعد از اسم می‌گذارد؛ انگلیسی برعکس.",
  that_omission: "در انگلیسی It is important لازم است؛ Is important ترجمه‌ی مستقیم فارسی است.",
  collocation: "ترجمه‌ی واژه‌به‌واژه کلمات همراه را می‌شکند؛ جفت‌های طبیعی را باید حفظ کرد.",
  register: "یک معنی، دو لحن؛ انتخاب لحن غلط در ایمیل و گفتگو به چشم می‌آید.",
  other: "این الگو از تکرار اشتباهات تو درآمده است.",
};

export interface AnalysisData {
  level: string;
  streak: number;
  today: { reviews: number; correct: number; xp: number };
  weekReviews: number;
  weekXp: number;
  activeDays14: number;
  due: number;
  seen: number;
  deckTotal: number;
  bySkill: { skill: string; lapseRate: number; reps: number; young: number }[];
  topTraps: { trap: string; count: number }[];
  chatCorrections: number;
  exams: { spec: string; percent: number; band: string; at: string }[];
  lastExam: { spec: string; percent: number; band: string } | null;
  writes: number;
  lastWriteLevel: string | null;
  speaks: number;
  avgSpeak: number | null;
}

export async function gatherData(): Promise<AnalysisData> {
  const today = dayIndex();
  const [learner, stats, states, logs, examRuns, writes, speaks, chatMsgs] = await Promise.all([
    db.learner.findUnique({ where: { id: "me" } }),
    db.dailyStat.findMany({ where: { day: { gte: today - 13 } } }),
    db.cardState.findMany(),
    db.reviewLog.findMany({ where: { grade: 1 }, orderBy: { id: "desc" }, take: 40 }),
    db.examRun.findMany({ orderBy: { id: "desc" }, take: 12 }),
    db.writingSub.findMany({ orderBy: { id: "desc" }, take: 5 }),
    db.speakSession.findMany({ orderBy: { id: "desc" }, take: 5 }),
    db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 60 }),
  ]);

  const weekReviews = stats.reduce((a, s) => a + s.reviews, 0);
  const weekXp = stats.reduce((a, s) => a + s.xp, 0);
  const activeDays14 = stats.filter((s) => s.reviews > 0 || s.xp > 0).length;
  const t = stats.find((s) => s.day === today);
  const seen = states.length;

  const bySkillMap: Record<string, { lapse: number; reps: number; young: number }> = {};
  for (const st of states) {
    const c = cardById(st.cardId);
    if (!c) continue;
    bySkillMap[c.skill] ??= { lapse: 0, reps: 0, young: 0 };
    bySkillMap[c.skill].lapse += st.lapses;
    bySkillMap[c.skill].reps += st.reps;
    if (st.s < 3 && st.state === "review") bySkillMap[c.skill].young += 1;
  }

  const trapCount: Record<string, number> = {};
  for (const r of logs) {
    const c = cardById(r.cardId);
    if (c) for (const tag of c.traps) trapCount[tag] = (trapCount[tag] ?? 0) + 1;
  }
  for (const m of chatMsgs) {
    try {
      const parsed = JSON.parse(m.content);
      for (const c of parsed?.corrections ?? []) if (c?.trap && c.trap !== "none") trapCount[c.trap] = (trapCount[c.trap] ?? 0) + 1;
    } catch { /* skip malformed */ }
  }

  const speakScores: number[] = [];
  for (const s of speaks) {
    try {
      const r = JSON.parse(s.result);
      const v = r?.scores ? (r.scores.fluency + r.scores.range + r.scores.accuracy + r.scores.delivery) / 4 : null;
      if (typeof v === "number") speakScores.push(v);
    } catch { /* skip */ }
  }

  const lastWrite = writes[0] ? safeJson(writes[0].result) : null;

  return {
    level: learner?.level && learner.level !== "?" ? learner.level : "unmeasured",
    streak: learner?.streak ?? 0,
    today: { reviews: t?.reviews ?? 0, correct: t?.correct ?? 0, xp: t?.xp ?? 0 },
    weekReviews,
    weekXp,
    activeDays14,
    due: 0,
    seen,
    deckTotal: 0,
    bySkill: Object.entries(bySkillMap)
      .map(([skill, a]) => ({ skill, lapseRate: a.reps ? a.lapse / a.reps : 0, reps: a.reps, young: a.young }))
      .sort((a, b) => b.lapseRate - a.lapseRate),
    topTraps: Object.entries(trapCount)
      .map(([trap, count]) => ({ trap, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    chatCorrections: chatMsgs.reduce((a, m) => {
      try {
        return a + ((JSON.parse(m.content)?.corrections ?? []).length || 0);
      } catch {
        return a;
      }
    }, 0),
    exams: examRuns.filter((e) => e.percent >= 0).map((e) => ({ spec: e.spec, percent: e.percent, band: e.band, at: e.at.toISOString().slice(0, 10) })),
    lastExam: examRuns.find((e) => e.percent >= 0)
      ? (() => {
          const e = examRuns.filter((e) => e.percent >= 0)[0];
          return { spec: e.spec, percent: e.percent, band: e.band };
        })()
      : null,
    writes: writes.length,
    lastWriteLevel: (lastWrite?.level as string) ?? null,
    speaks: speaks.length,
    avgSpeak: speakScores.length ? Math.round((speakScores.reduce((a, b) => a + b, 0) / speakScores.length) * 10) / 10 : null,
  };
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ---------- deep level analysis ----------
function skillBands(d: AnalysisData): SkillBand[] {
  const find = (name: string) => d.bySkill.find((s) => s.skill === name);
  const mk = (name: string, name_fa: string, base: number, note: string): SkillBand => ({
    name, name_fa, band: bandFromScore(base), score: base, note,
  });
  const vocab = find("vocabulary");
  const colloc = find("collocation");
  const baseVocab = clamp(55 + (vocab ? (1 - vocab.lapseRate) * 30 : 0) + (colloc ? (1 - colloc.lapseRate) * 15 : 0));
  const grammarTrap = d.topTraps.filter((t) => ["articles", "tense", "prepositions", "perfect", "statives", "copula", "plurals", "countability", "question_order"].includes(t.trap)).reduce((a, t) => a + t.count, 0);
  const baseGrammar = clamp(62 - grammarTrap * 2 + (d.level === "C1" ? 10 : 0));
  const baseReading = clamp(50 + d.exams.filter((e) => e.spec === "reading").slice(0, 3).reduce((a, e) => a + e.percent, 0) / Math.max(1, Math.min(3, d.exams.filter((e) => e.spec === "reading").length || 1)) * 0.4);
  const baseListening = clamp(40 + d.today.reviews * 2 + d.weekReviews / 10);
  const baseWriting = clamp(d.writes ? (d.lastWriteLevel === "C1" ? 82 : d.lastWriteLevel === "B2+" ? 72 : 62) : 35 + d.writes * 5);
  const baseSpeaking = clamp(d.avgSpeak ? d.avgSpeak * 10 : d.speaks ? 55 : 30);
  return [
    mk("Vocabulary", "واژگان", baseVocab, vocab ? `${Math.round(vocab.lapseRate * 100)}% lapse rate on ${vocab.reps} reps` : "card data still thin"),
    mk("Grammar", "گرامر", baseGrammar, grammarTrap ? `${grammarTrap} grammar-trap hits` : "few grammar traps logged"),
    mk("Reading", "خواندن", baseReading, d.exams.some((e) => e.spec === "reading") ? "reading exam on record" : "no reading exam yet"),
    mk("Listening", "شنیدن", baseListening, `${d.weekReviews} reviews this week feed it`),
    mk("Writing", "نگارش", baseWriting, d.writes ? `${d.writes} graded submissions` : "no submissions yet"),
    mk("Speaking", "گفتار", baseSpeaking, d.avgSpeak ? `avg ${d.avgSpeak}/10 across sessions` : "no sessions yet"),
  ];
}

function bandFromScore(s: number): string {
  return s >= 85 ? "C1" : s >= 72 ? "B2+" : s >= 58 ? "B2" : s >= 45 ? "B2-" : s >= 30 ? "B1" : "A2";
}
function clamp(n: number): number {
  return Math.max(5, Math.min(97, Math.round(n)));
}

const deepSystem = (d: AnalysisData) => `You are Rah's diagnostic engine. Below is ALL recorded data for one Farsi-speaking learner in the app: FSRS review stats by skill, logged interference traps (from lapses and chat corrections), exam history, writing and speaking records.

Data: ${JSON.stringify(d)}

Produce the deep level analysis. Rules:
- overall: ONE CEFR band ("A2" to "C1"). Weigh objective exam bands highest, then writing level, then FSRS lapse data. If data is thin, say the band is provisional via confidence.
- skills: exactly these 6 in order: Vocabulary, Grammar, Reading, Listening, Writing, Speaking. For each: band string, score 0 to 100, note (one short English line citing the actual data).
- evidence: 3 to 4 bullets, each citing a concrete number from the data.
- leaks: top 2 to 3 interference traps with a Farsi line explaining why it happens to Farsi speakers.
- plan: exactly 3 steps for the next 7 days, concrete and small. Each with a Farsi why.

Output ONE JSON object, nothing else:
{"overall": "", "confidence": "low|medium|high", "skills": [{"name": "Vocabulary", "name_fa": "واژگان", "band": "", "score": 0, "note": ""}], "evidence": [], "leaks": [{"trap": "", "fa": ""}], "plan": [{"step": "", "fa": ""}]}
Never use the em dash character anywhere in your output.`;

export async function deepLevel(): Promise<DeepLevelReport> {
  const d = await gatherData();
  const skills = skillBands(d);
  const fallback: DeepLevelReport = {
    overall: d.lastExam?.band || (d.level !== "unmeasured" ? d.level : bandFromScore(Math.round(skills.reduce((a, s) => a + s.score, 0) / skills.length))),
    confidence: d.exams.length ? "high" : d.weekReviews > 50 ? "medium" : "low",
    skills,
    evidence: [
      `${d.weekReviews} reviews in 14 days across ${d.activeDays14} active days`,
      d.lastExam ? `last exam: ${d.lastExam.percent}% on ${d.lastExam.spec} (band ${d.lastExam.band})` : "no exam on record yet",
      `${d.chatCorrections} live corrections collected in chat`,
      d.topTraps.length ? `top trap: ${d.topTraps[0].trap} (${d.topTraps[0].count} hits)` : "no trap pattern logged yet",
    ],
    leaks: d.topTraps.slice(0, 3).map((t) => ({ trap: t.trap, fa: TRAP_FA[t.trap] ?? TRAP_FA.other })),
    plan: [
      { step: "Run a full mock exam to anchor the band with objective data.", fa: "با یک آزمون جامع، سطح واقعی‌ات را با داده عینی بسنج." },
      { step: `Drill the leakiest skill: ${d.bySkill[0]?.skill ?? "collocation"}.`, fa: "روی ضعیف‌ترین مهارت تمرین مستقیم بگذار." },
      { step: "Clear the due queue three days in a row.", fa: "سه روز پشت سر هم صف مرور را خالی کن." },
    ],
    source: "mechanical",
  };
  try {
    const out = await aiJson<DeepLevelReport>(deepSystem(d), [{ role: "user", content: "Produce the deep level analysis now. Think through every skill dimension against the data before writing." }], undefined, { thinking: true, attempts: 3 });
    if (out?.overall && Array.isArray(out.skills) && out.skills.length >= 4) {
      return { ...fallback, ...out, skills: out.skills.slice(0, 6), source: "ai" };
    }
  } catch { /* keep mechanical */ }
  return fallback;
}

// ---------- error pattern diagnosis ----------
const diagSystem = (d: AnalysisData) => `You are Rah's error diagnostician. Data for one Farsi-speaking learner: trap tag counts (from FSRS lapses + live chat corrections), skill lapse rates, recent corrections context.

Data: ${JSON.stringify(d)}

Name the RECURRING patterns, not one-off slips. For each of the top 2 to 4 traps: title (short English, e.g. "The missing article"), fa (Farsi root cause, 1 to 2 lines), fix (one concrete micro-strategy in English). headline: one English sentence. verdict: two English sentences on what this means at their level.

Output ONE JSON object, nothing else:
{"headline": "", "patterns": [{"trap": "", "title": "", "count": 0, "fa": "", "fix": ""}], "verdict": ""}
Never use the em dash character anywhere in your output.`;

export async function errorDiagnosis(): Promise<DiagnosisReport> {
  const d = await gatherData();
  const fallback: DiagnosisReport = {
    headline: d.topTraps.length
      ? `Your most persistent pattern is "${d.topTraps[0].trap}" with ${d.topTraps[0].count} hits.`
      : "Not enough error history yet; keep chatting and reviewing to build the sample.",
    patterns: d.topTraps.slice(0, 3).map((t) => ({
      trap: t.trap,
      title: t.trap.replace(/_/g, " "),
      count: t.count,
      fa: TRAP_FA[t.trap] ?? TRAP_FA.other,
      fix: t.trap === "articles" ? "Say the noun with a/an/the or '-' out loud before writing it." : "Collect your own 5 wrong sentences and rewrite each correctly once.",
    })),
    verdict: d.topTraps.length
      ? "Patterns like these are habits, not knowledge gaps. Micro-strategies beat re-reading rules."
      : "Once you have 10+ corrections on record, this report turns into your personal trap map.",
    source: "mechanical",
  };
  try {
    const out = await aiJson<DiagnosisReport>(diagSystem(d), [{ role: "user", content: "Diagnose the error patterns now. Trace each repeating mistake to its Farsi-interference root." }], undefined, { thinking: true, attempts: 3 });
    if (out?.patterns?.length) return { ...fallback, ...out, source: "ai" };
  } catch { /* keep mechanical */ }
  return fallback;
}

// ---------- progress forecast ----------
const forecastSystem = (d: AnalysisData) => `You are Rah's forecast engine. Data: ${JSON.stringify(d)}

Estimate: at the CURRENT pace, how long to solid C1? pace: one line in English describing the measured pace (reviews/day, exams, active days). eta_weeks: integer number of weeks (null if data is too thin). moves: 3 changes that would shorten it most, each {move, effect} in English. headline: one honest English sentence.

Output ONE JSON object, nothing else:
{"headline": "", "pace": "", "eta_weeks": 0, "moves": [{"move": "", "effect": ""}]}
Never use the em dash character anywhere in your output.`;

export async function forecast(): Promise<ForecastReport> {
  const d = await gatherData();
  const perDay = d.weekReviews / 14;
  const eta = perDay >= 30 ? 16 : perDay >= 15 ? 26 : perDay >= 5 ? 40 : null;
  const fallback: ForecastReport = {
    headline: eta
      ? `At ${Math.round(perDay)} reviews/day, solid C1 is roughly ${eta} weeks out.`
      : "Too little data to project honestly; raise the daily volume for two weeks first.",
    pace: `${Math.round(perDay)} reviews/day over 14 days, ${d.activeDays14} active days, ${d.exams.length} exams taken.`,
    eta_weeks: eta,
    moves: [
      { move: "Add one 10-minute speaking session daily", effect: "Speaking is the slowest skill to catch up; early volume compounds." },
      { move: "Run one exam per week", effect: "Objective anchors stop the band estimate from drifting." },
      { move: "Clear the due queue before new cards", effect: "Lapses shrink; retention compounds instead of leaking." },
    ],
    source: "mechanical",
  };
  try {
    const out = await aiJson<ForecastReport>(forecastSystem(d), [{ role: "user", content: "Produce the forecast now. Reason from the real pace numbers, then sanity-check the estimate." }], undefined, { thinking: true, attempts: 3 });
    if (out?.headline) return { ...fallback, ...out, source: "ai" };
  } catch { /* keep mechanical */ }
  return fallback;
}

// ---------- daily plan ----------
const planSystem = (d: AnalysisData) => `You are Rah's planner. Current data: ${JSON.stringify(d)}

Build TODAY's plan: 3 to 5 blocks, total 20 to 40 minutes, each {icon (one of: review, drill, exam, write, speak, listen, read), title (English, concrete: what exactly to do), why (Farsi, one line), minutes (5, 10, 15, or 20)}. Order by payoff. headline: one English line. Use the real due count and weak skills from the data.

Output ONE JSON object, nothing else:
{"headline": "", "blocks": [{"icon": "review", "title": "", "why": "", "minutes": 10}]}
Never use the em dash character anywhere in your output.`;

export async function dailyPlan(): Promise<PlanReport> {
  const d = await gatherData();
  const fallback: PlanReport = {
    headline: d.due > 0 ? `${d.due} cards are due; clear them, then one targeted drill.` : "Queue is clear: produce something today, a drill or a short write.",
    blocks: [
      { icon: "review", title: `Clear ${Math.max(d.due, 5)} due cards`, why: "مرور امروز، قفل حافظه‌ی فرداست.", minutes: 10 },
      { icon: "drill", title: `Drill ${d.bySkill[0]?.skill ?? "collocation"} (6 items)`, why: "ضعیف‌ترین مهارتت همین است؛ ۶ تمرین هدفمند بزن.", minutes: 10 },
      { icon: "speak", title: "One 2-minute speaking take", why: "تولید شفاهی، سریع‌ترین آینه‌ی سطح توست.", minutes: 10 },
    ],
    source: "mechanical",
  };
  try {
    const out = await aiJson<PlanReport>(planSystem(d), [{ role: "user", content: "Build today's plan now. Fit the blocks to the learner's actual weak spots and available energy." }], undefined, { thinking: true, attempts: 3 });
    if (out?.blocks?.length) return { ...fallback, ...out, source: "ai" };
  } catch { /* keep mechanical */ }
  return fallback;
}
