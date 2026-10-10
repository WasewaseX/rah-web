// Exam engine: generates formal multi-section exams, grades them with the
// two-pass smart grader (mechanical + fuzzy, then the deep examiner), and
// produces the assessment report. Contract: an exam ALWAYS exists. If the
// model output fails validation after retries, a randomized bank exam ships
// instead. The tutor can never say "I can't generate an exam".

import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import type { Exam, ExamQuestion } from "./types";
import { bankDrill } from "./drill";

export type ExamSpec = "mixed" | "vocabulary" | "grammar" | "collocation" | "reading";

const SPEC_PLAN: Record<ExamSpec, { time: number; sections: string; count: string }> = {
  mixed: {
    time: 15,
    sections: `1. "Vocabulary": 4 mcq items. 2. "Collocation": 3 cloze items. 3. "Grammar": 3 transform items. 4. "Reading": one 120-word passage (put it in passage) + 2 mcq questions. 5. "Writing": 1 write item (a short opinion prompt; answer is a model answer in one sentence).`,
    count: "13 questions total",
  },
  vocabulary: {
    time: 10,
    sections: `1. "Vocabulary": 6 mcq + 2 cloze + 2 short items.`,
    count: "10 questions total",
  },
  grammar: {
    time: 10,
    sections: `1. "Grammar": 4 mcq (choose the correct sentence / error spotting), 3 cloze, 3 transform items.`,
    count: "10 questions total",
  },
  collocation: {
    time: 8,
    sections: `1. "Collocation": 6 cloze (type the partnering word) + 4 mcq.`,
    count: "10 questions total",
  },
  reading: {
    time: 12,
    sections: `1. "Reading": one 130 to 160-word passage at ${"{level}"} (put it in passage) + 4 mcq (2 literal, 2 inferential) + 2 short answers (own words).`,
    count: "6 questions total",
  },
};

export function examSystem(spec: ExamSpec, level: string, p: ProfileJson): string {
  const plan = SPEC_PLAN[spec].sections.replace("{level}", level);
  return `You are the exam writer inside Rah, an English app for Farsi speakers targeting ${level}. The learner's profile: weak skills ${JSON.stringify(p.weakSkills)}, recent traps ${JSON.stringify(p.recentTraps)}.

Write ONE exam. Plan: ${plan}

Item rules:
- mcq: exactly 4 choices, plausible distractors (same word class, similar length), answer repeats the correct choice EXACTLY.
- cloze: sentence with ___ ; answer is the missing word or short phrase, lowercase.
- acceptable: THIS LIST IS CRITICAL. For every cloze, short and transform item list 3 to 8 wordings a competent speaker could justifiably produce: real synonyms ("address" alongside "tackle"), alternative collocations a native would accept, paraphrases of the full answer, and the answer with and without articles ("took advantage of the weather" / "took advantage of weather"). NEVER leave acceptable empty for typed answers. If two words are both genuinely standard in this slot, both belong in acceptable.
- transform: rewrite task with an instruction in the prompt like "rewrite with 'despite'". In acceptable list every correct wording you would accept (lowercase, no ending punctuation).
- short: question needing a phrase or one sentence; answer + acceptable variants lowercase.
- write: q = the essay prompt (two parts, 150-word target), answer = ONE model sentence showing the expected quality.
- why: one line, simple English, teaching the point. fa: one line Farsi feedback for a wrong answer (never the answer itself).
- Difficulty: true ${level}. Test active production, not trivia. No trick questions. Never write an item whose key has only one possible wording unless it is a fixed idiom.

Output ONE JSON object, nothing else:
{"title": "short English title", "title_fa": "عنوان فارسی کوتاه", "sections": [{"name": "Vocabulary", "passage": null, "questions": [{"type": "mcq", "q": "", "choices": ["", "", "", ""], "answer": "", "acceptable": [], "why": "", "fa": ""}, {"type": "cloze", "q": "with ___", "answer": "", "acceptable": ["", ""], "why": "", "fa": ""}, {"type": "write", "q": "", "answer": "", "why": "", "fa": ""}]}]}
Never use the em dash character anywhere in your output.`;
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[.!?,;:"'`]/g, "").replace(/\s+/g, " ");
}

function fixItem(raw: any, section: string, i: number): ExamQuestion | null {
  const type = ["mcq", "cloze", "transform", "short", "write"].includes(raw?.type) ? raw.type : null;
  if (!type || typeof raw.q !== "string" || !raw.q.trim() || typeof raw.answer !== "string" || !raw.answer.trim()) return null;
  const item: ExamQuestion = {
    id: `q${i + 1}`,
    type,
    section,
    q: raw.q.trim(),
    answer: raw.answer.trim(),
    acceptable: Array.isArray(raw.acceptable) ? raw.acceptable.filter((a: unknown) => typeof a === "string" && a.trim()).map((a: string) => a.trim()).slice(0, 8) : [],
    why: typeof raw.why === "string" ? raw.why.slice(0, 220) : "",
    fa: typeof raw.fa === "string" ? raw.fa.slice(0, 220) : "",
    points: type === "write" ? 5 : 1,
  };
  if (typeof raw.passage === "string" && raw.passage.trim().length > 40) item.passage = raw.passage.trim();
  if (type === "mcq") {
    const choices = (raw.choices ?? []).filter((c: unknown) => typeof c === "string" && c.trim()).map((c: string) => c.trim()).slice(0, 4);
    if (choices.length >= 3) {
      if (!choices.some((c: string) => norm(c) === norm(item.answer))) choices[0] = item.answer;
      while (choices.length < 4) choices.push(`Option ${choices.length + 1}`);
      item.choices = choices;
    } else {
      return null;
    }
  }
  return item;
}

function flatten(raw: any): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  const sections = Array.isArray(raw?.sections) ? raw.sections : Array.isArray(raw?.items) ? [{ name: "Exam", questions: raw.items }] : [];
  let i = 0;
  let lastPassage: string | undefined;
  for (const sec of sections) {
    const name = typeof sec?.name === "string" && sec.name.trim() ? sec.name.trim() : "Section";
    if (typeof sec?.passage === "string" && sec.passage.trim().length > 40) lastPassage = sec.passage.trim();
    for (const q of Array.isArray(sec?.questions) ? sec.questions : []) {
      const fixed = fixItem(q, name, i++);
      if (fixed) {
        if (!fixed.passage && lastPassage && name.toLowerCase().includes("read")) fixed.passage = lastPassage;
        out.push(fixed);
      }
    }
  }
  return out;
}

const WRITE_RE = /write/i;

export async function generateExam(spec: ExamSpec, level: string, p: ProfileJson): Promise<{ exam: Omit<Exam, "id">; source: "ai" | "bank" }> {
  // Deep thinking: the writer plans distractors, keys and variant lists before
  // emitting. Four attempts; the bank only ships if every one of them fails.
  try {
    const out = await aiJson<any>(
      examSystem(spec, level, p),
      [{ role: "user", content: `Write the ${spec} exam now. Target level ${level}. Profile: ${JSON.stringify(p)}.` }],
      undefined,
      { thinking: true, attempts: 4 },
    );
    const questions = flatten(out);
    const objective = questions.filter((q) => !WRITE_RE.test(q.type) && q.type !== "write");
    const hasWrite = questions.some((q) => q.type === "write");
    const needWrite = spec === "mixed";
    if (objective.length >= 7 && (!needWrite || hasWrite)) {
      return {
        exam: {
          title: typeof out?.title === "string" && out.title.trim() ? out.title.slice(0, 90) : `${spec} exam`,
          title_fa: typeof out?.title_fa === "string" && out.title_fa.trim() ? out.title_fa.slice(0, 60) : "آزمون",
          level,
          spec,
          timeLimitMin: SPEC_PLAN[spec].time,
          questions,
        },
        source: "ai",
      };
    }
  } catch {
    // fall through to the bank
  }
  return { exam: bankExam(spec, level), source: "bank" };
}

// ---------- randomized static bank (last resort, never identical twice) ----------

function fromBank(spec: ExamSpec): ExamQuestion[] {
  let items: any[] = [];
  if (spec === "vocabulary") items = [...BANKSAFE("vocab"), ...BANKSAFE("synonym")];
  else if (spec === "grammar") items = [...BANKSAFE("tense"), ...BANKSAFE("articles"), ...BANKSAFE("preposition")];
  else if (spec === "collocation") items = [...BANKSAFE("collocation"), ...BANKSAFE("vocab").slice(0, 4)];
  else items = [...BANKSAFE("vocab").slice(0, 6), ...BANKSAFE("collocation").slice(0, 4), ...BANKSAFE("tense").slice(0, 4), ...BANKSAFE("paraphrase").slice(0, 3)];
  let i = 0;
  return shuffle(items).slice(0, spec === "mixed" ? 13 : 10).map((it) => ({
    id: `q${++i}`,
    type: it.type === "transform" ? "transform" : it.type === "cloze" ? "cloze" : it.type === "mcq" ? "mcq" : "short",
    section: it.type === "mcq" ? "Vocabulary" : "Structure",
    q: it.q,
    choices: it.choices,
    answer: it.answer,
    acceptable: it.acceptable ?? [],
    why: it.why,
    fa: it.fa,
    points: 1,
  })) as ExamQuestion[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function BANKSAFE(topic: string) {
  return bankDrill(topic).items;
}

const READING_PASSAGE = {
  passage:
    "When a city decides to pedestrianize its center, the first weeks are always the loudest. Shopkeepers warn that deliveries will strangle trade, drivers circulate for parking spaces that no longer exist, and local papers run before-and-after photos of empty streets. Then something quieter happens. Foot traffic returns, but slower: people linger in squares that used to be gaps between destinations. Retail studies from Oslo to Seoul describe the same pattern, storefront revenue dips for a quarter, then stabilizes above the baseline as visitors stop by on foot rather than driving past. The lesson is rarely the one either side predicted. Cars were never the customers; they were the weather, and streets built for weather rarely feel like places.",
  questions: [
    { type: "mcq", q: "What happens to shop revenue after pedestrianization, according to the passage?", choices: ["It collapses permanently", "It dips briefly, then exceeds the old baseline", "It rises immediately", "It stays flat throughout"], answer: "It dips briefly, then exceeds the old baseline", why: "The text says revenue dips for a quarter, then stabilizes above the baseline.", fa: "طبق متن، درآمد اول کمی افت می‌کند سپس از خط پایه بالاتر می‌رود." },
    { type: "mcq", q: "The writer calls cars 'the weather' to suggest they are:", choices: ["welcome visitors", "an environmental condition, not customers", "unpredictable but harmless", "essential for trade"], answer: "an environmental condition, not customers", why: "The metaphor separates passing cars from real foot-falling customers.", fa: "استعاره weather یعنی ماشین‌ها مشتری نیستند، شرایط محیط‌اند." },
    { type: "mcq", q: "'Strangle trade' in the first paragraph is closest in meaning to:", choices: ["boost trade", "suffocate trade", "measure trade", "steal trade"], answer: "suffocate trade", why: "Strangle = squeeze the life out of.", fa: "strangle یعنی خفه کردن؛ اینجا یعنی تجارت را فلج کردن." },
    { type: "short", q: "In one phrase: what do people do in squares once cars are gone?", answer: "linger", acceptable: ["linger in squares", "they linger", "spend time", "stop and stay", "hang around", "linger around", "stay longer", "walk slowly and stay"], why: "The passage says people 'linger in squares that used to be gaps'.", fa: "مردم در میدان‌ها می‌مانند و وقتی می‌گذرانند." },
  ],
};

export function bankExam(spec: ExamSpec, level: string): Omit<Exam, "id"> {
  if (spec === "reading") {
    let i = 0;
    const questions: ExamQuestion[] = shuffle(READING_PASSAGE.questions).map((q) => ({
      id: `q${++i}`,
      type: q.type as ExamQuestion["type"],
      section: "Reading",
      q: q.q,
      passage: READING_PASSAGE.passage,
      choices: (q as any).choices,
      answer: q.answer,
      acceptable: (q as any).acceptable ?? [],
      why: (q as any).why,
      fa: (q as any).fa,
      points: 1,
    }));
    return {
      title: "Reading: the pedestrian experiment",
      title_fa: "آزمون خواندن",
      level, spec, timeLimitMin: 12, questions,
    };
  }
  const questions = fromBank(spec);
  return {
    title: spec === "mixed" ? "Full mock exam (core battery)" : `${spec[0].toUpperCase()}${spec.slice(1)} exam`,
    title_fa: spec === "mixed" ? "آزمون جامع" : "آزمون",
    level, spec, timeLimitMin: SPEC_PLAN[spec].time, questions,
  };
}
