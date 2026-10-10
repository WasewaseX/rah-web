// Rah exam engine. Generates exams and grades them the way a human examiner
// would: an answer is correct if it means the same thing, not only if it
// matches the key character for character. Counts are always consistent:
// the exam has exactly the items it announces, and every item is graded.

import { aiJson, type ProfileJson } from "@/lib/ai";

export type ExamSkill =
  | "grammar"
  | "vocabulary"
  | "collocation"
  | "spelling"
  | "writing"
  | "reading"
  | "listening"
  | "mixed";

export type ExamItemKind = "mcq" | "cloze" | "rewrite" | "short" | "translate";

export interface ExamItem {
  id: string;
  skill: Exclude<ExamSkill, "mixed">;
  kind: ExamItemKind;
  prompt: string; // the question, possibly with ___ for cloze
  choices?: string[]; // mcq only, always 4
  answer: string; // the primary correct answer
  accepted: string[]; // other fully correct wordings (synonyms, rewrites)
  synonyms: string[][]; // groups of interchangeable words, any one group may be swapped
  hint: string; // Farsi nudge that does not give the answer away
  why: string; // one-line teaching point in English
}

export interface ExamSpec {
  id: string;
  kind: "standard" | "quick" | "deep";
  skill: ExamSkill;
  level: string;
  title: string;
  minutes: number;
  items: ExamItem[];
}

export interface PublicExamItem {
  id: string;
  skill: string;
  kind: ExamItemKind;
  prompt: string;
  choices?: string[];
  hint: string;
}

export interface ItemResult {
  id: string;
  skill: string;
  correct: boolean;
  given: string;
  expected: string;
  note: string; // precise feedback: what exactly was wrong or why it passed
}

export interface ExamResult {
  examId: string;
  title: string;
  total: number;
  answered: number;
  correct: number;
  pct: number;
  perSkill: { skill: string; correct: number; total: number }[];
  items: ItemResult[];
  verdict: string;
}

// ---------- generation ----------

function examSystem(skill: ExamSkill, level: string, count: number): string {
  const scope =
    skill === "mixed"
      ? "Mix the whole range: collocations, grammar, vocabulary, one rewrite, one short production item."
      : `Focus every item on ${skill}. Vary the angles within that skill.`;
  return `You are the exam writer inside Rah, an English app for Farsi speakers moving from B2 to C1. Write ONE exam.

${scope}
Exactly ${count} items, no more, no less. Target level ${level}.
Item kinds to use (mix at least 3 kinds): mcq (4 choices), cloze (sentence with ___, answer is the exact missing string), rewrite (learner rewrites a sentence following an instruction), short (one-phrase answer to a real question), translate (one natural Farsi sentence rendered in English).

Rules that make grading fair:
1. "answer" is the single best response. "accepted" lists every other wording a competent examiner would mark correct (synonyms, alternative collocations, valid rewrites). For collocation items, list natural alternatives, not just one dogmatic answer. Example: if the target is "take advantage of", accepted may include "make the most of", "exploit".
2. "synonyms" groups words that can replace each other inside the answer, e.g. [["raise","voice","bring up"],["issue","matter","point"]]. Keep groups small and truly interchangeable in context. Use [] when none.
3. Cloze answers are short (1 to 4 words). Rewrite answers are full sentences.
4. Every item teaches something a Farsi speaker actually gets wrong at ${level}: articles, countability, collocations that do not map from Farsi, register, precise verbs.
5. "hint" is one short Farsi nudge that does NOT reveal the answer. "why" is one English line: the teaching point.
6. Never use the em dash character anywhere.

Output ONE JSON object, nothing else:
{"title": "short exam title", "minutes": 10, "items": [{"id": "q1", "skill": "collocation", "kind": "mcq", "prompt": "", "choices": ["","","",""], "answer": "", "accepted": [], "synonyms": [], "hint": "", "why": ""}]}
mcq: choices has exactly 4 entries and answer repeats the correct choice exactly. Other kinds: omit choices.
Item ids are q1, q2, ... in order. Exactly ${count} items.`;
}

interface RawExam {
  title: string;
  minutes: number;
  items: {
    id?: string;
    skill?: string;
    kind?: string;
    prompt?: string;
    choices?: string[];
    answer?: string;
    accepted?: string[];
    synonyms?: string[][];
    hint?: string;
    why?: string;
  }[];
}

const SKILLS: ExamItem["skill"][] = ["grammar", "vocabulary", "collocation", "spelling", "writing", "reading", "listening"];
const KINDS: ExamItemKind[] = ["mcq", "cloze", "rewrite", "short", "translate"];

function sanitizeItem(raw: RawExam["items"][number], i: number): ExamItem | null {
  const prompt = String(raw.prompt ?? "").trim();
  const answer = String(raw.answer ?? "").trim();
  if (!prompt || !answer) return null;
  let kind = KINDS.includes(raw.kind as ExamItemKind) ? (raw.kind as ExamItemKind) : "short";
  let choices = (raw.choices ?? []).map((c) => String(c).trim()).filter(Boolean);
  if (kind === "mcq" && choices.length !== 4) {
    // A broken mcq degrades to cloze instead of breaking the exam.
    kind = "cloze";
    choices = undefined as unknown as string[];
  }
  const skill = SKILLS.includes(raw.skill as ExamItem["skill"]) ? (raw.skill as ExamItem["skill"]) : "grammar";
  const accepted = (raw.accepted ?? []).map((a) => String(a).trim()).filter(Boolean).slice(0, 6);
  const synonyms = (raw.synonyms ?? [])
    .filter(Array.isArray)
    .map((g) => g.map((w) => String(w).trim().toLowerCase()).filter(Boolean))
    .filter((g) => g.length >= 2)
    .slice(0, 4);
  return {
    id: `q${i + 1}`,
    skill,
    kind,
    prompt,
    choices: kind === "mcq" ? choices : undefined,
    answer,
    accepted,
    synonyms,
    hint: String(raw.hint ?? "").trim(),
    why: String(raw.why ?? "").trim(),
  };
}

export async function generateExam(
  opts: { skill?: ExamSkill; count?: number; kind?: "standard" | "quick" | "deep"; profile: ProfileJson },
): Promise<ExamSpec> {
  const skill = opts.skill ?? "mixed";
  const count = Math.max(3, Math.min(15, opts.count ?? 10));
  const kind = opts.kind ?? "standard";
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await aiJson<RawExam>(
        examSystem(skill, opts.profile.level, count),
        [
          {
            role: "user",
            content: `Write the exam now. Learner profile: ${JSON.stringify(opts.profile)}. Exactly ${count} items.`,
          },
        ],
      );
      const items = (raw.items ?? [])
        .map((r, i) => sanitizeItem(r, i))
        .filter((x): x is ExamItem => x !== null)
        .slice(0, count);
      // Hard guarantee: the exam never announces more than it carries.
      if (items.length < Math.min(3, count)) throw new Error("exam too short");
      return {
        id: "",
        kind,
        skill,
        level: opts.profile.level,
        title: String(raw.title ?? "").trim().slice(0, 80) || `${skillLabel(skill)} exam`,
        minutes: Math.max(3, Math.min(30, Number(raw.minutes) || Math.ceil(items.length))),
        items,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("exam generation failed");
}

export function skillLabel(s: ExamSkill): string {
  return s === "mixed" ? "Mixed skills" : s.charAt(0).toUpperCase() + s.slice(1);
}

export function toPublicExam(spec: ExamSpec): { spec: Omit<ExamSpec, "items">; items: PublicExamItem[] } {
  const { items, ...rest } = spec;
  return {
    spec: rest,
    items: items.map((it) => ({
      id: it.id,
      skill: it.skill,
      kind: it.kind,
      prompt: it.prompt,
      choices: it.choices,
      hint: it.hint,
    })),
  };
}

// ---------- grading ----------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:¿¡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripArticles(s: string): string {
  return s.replace(/^(a|an|the)\s+/, "").trim();
}

function tokenMatch(given: string, target: string, item: ExamItem): boolean {
  const g = normalize(given);
  const t = normalize(target);
  if (!g || !t) return false;
  if (g === t) return true;
  // Article tolerance: "raise issue" passes for "raise the issue" unless the
  // exam item is specifically about articles.
  if (stripArticles(g) === stripArticles(t)) {
    if (item.skill !== "grammar" || !/___\s*(a|an|the)\b|articles/i.test(item.prompt)) return true;
  }
  // Word-set match: same words, order-tolerant, catches "the issue raised" style answers.
  const gw = new Set(g.split(" ").filter(Boolean));
  const tw = t.split(" ").filter(Boolean);
  if (tw.length > 1 && tw.every((w) => gw.has(w))) return true;
  // Synonym groups: every target word can be swapped through its group.
  const gWords = g.split(" ");
  const mapped = tw.map((w) => {
    if (gw.has(w)) return true;
    const group = item.synonyms.find((set) => set.includes(w));
    return group ? group.some((alt) => gWords.includes(alt)) : false;
  });
  if (mapped.length > 0 && mapped.every(Boolean)) return true;
  // Stem tolerance for single-word answers: tense/plural endings.
  if (tw.length === 1 && gWords.length === 1) {
    const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
    return stem(g) === stem(t) && stem(g).length >= 3;
  }
  return false;
}

function gradeClosed(item: ExamItem, given: string): { correct: boolean; note: string } {
  if (tokenMatch(given, item.answer, item)) return { correct: true, note: "" };
  for (const acc of item.accepted) {
    if (tokenMatch(given, acc, item)) {
      return { correct: true, note: `Accepted: "${acc}" is a valid answer here.` };
    }
  }
  // Precise feedback: name the gap instead of parroting the key.
  const g = normalize(given);
  const t = normalize(item.answer);
  if (stripArticles(g) === stripArticles(t) && g !== t) {
    return { correct: false, note: `The wording is right but the article is off: it is "${item.answer}".` };
  }
  const tWords = t.split(" ");
  const gWords = g.split(" ");
  const missing = tWords.filter((w) => !gWords.includes(w));
  if (missing.length === 1 && tWords.length > 1) {
    return { correct: false, note: `Close. You are missing "${missing[0]}" ("${item.answer}").` };
  }
  return { correct: false, note: `The natural answer here is "${item.answer}".` };
}

interface JudgeVerdict {
  results: { id: string; correct: boolean; note: string }[];
}

// Open-ended items (rewrite, short, translate) get one LLM judging pass so a
// different-but-correct wording is never punished.
async function judgeOpen(
  items: { item: ExamItem; given: string }[],
  level: string,
): Promise<Map<string, { correct: boolean; note: string }>> {
  const out = new Map<string, { correct: boolean; note: string }>();
  if (items.length === 0) return out;
  const payload = items.map(({ item, given }) => ({
    id: item.id,
    task: item.prompt,
    expected: item.answer,
    also_accepted: item.accepted,
    learner_answer: given,
  }));
  try {
    const v = await aiJson<JudgeVerdict>(
      `You are the examiner for Rah, an English app for Farsi speakers at ${level}. Judge these open English-production answers.

For each one decide: is the learner's answer correct English that fulfills the task? Accept any wording a fair human examiner would accept, including valid synonyms and restructurings. Reject only real errors: wrong meaning, broken grammar, wrong collocation, missing required element from the task.
The "note" is ONE short English sentence addressed to the learner: if correct and the wording differs from the key, say why theirs still works; if wrong, name the exact problem (missing word, wrong verb, article, and so on). Never use the em dash character.

Output ONE JSON object, nothing else:
{"results": [{"id": "q1", "correct": true, "note": ""}]}
Judge every input id exactly once.`,
      [{ role: "user", content: JSON.stringify(payload) }],
    );
    for (const r of v.results ?? []) {
      if (r && typeof r.id === "string") {
        out.set(r.id, { correct: Boolean(r.correct), note: String(r.note ?? "").slice(0, 200) });
      }
    }
  } catch {
    // Judge unreachable: fall through to conservative key matching below.
  }
  return out;
}

export async function gradeExam(
  spec: ExamSpec,
  answers: Record<string, string>,
): Promise<ExamResult> {
  const open: { item: ExamItem; given: string }[] = [];
  for (const item of spec.items) {
    const given = String(answers[item.id] ?? "").trim();
    if (given && item.kind !== "mcq" && item.kind !== "cloze") open.push({ item, given });
  }
  const judged = await judgeOpen(open, spec.level);

  const items: ItemResult[] = spec.items.map((item) => {
    const given = String(answers[item.id] ?? "").trim();
    if (!given) {
      return { id: item.id, skill: item.skill, correct: false, given, expected: item.answer, note: "Left blank." };
    }
    if (judged.has(item.id)) {
      const j = judged.get(item.id)!;
      return { id: item.id, skill: item.skill, correct: j.correct, given, expected: item.answer, note: j.note };
    }
    const { correct, note } = gradeClosed(item, given);
    return { id: item.id, skill: item.skill, correct, given, expected: item.answer, note };
  });

  const total = items.length;
  const correct = items.filter((r) => r.correct).length;
  const answered = items.filter((r) => r.given.length > 0).length;
  const bySkill = new Map<string, { correct: number; total: number }>();
  for (const r of items) {
    const s = bySkill.get(r.skill) ?? { correct: 0, total: 0 };
    s.total += 1;
    if (r.correct) s.correct += 1;
    bySkill.set(r.skill, s);
  }
  const weak = items.find((r) => !r.correct && r.note && !r.note.startsWith("Left blank"));
  const verdict =
    correct === total
      ? "Full marks. This area is solid; push to the next skill."
      : correct / total >= 0.8
        ? `Strong pass. ${weak ? `Worth one more look: ${weak.note}` : "Small slips only."}`
        : correct / total >= 0.5
          ? `Middle ground: ${total - correct} items to repair. The notes below name the exact gaps.`
          : "This area needs real work. Read each note, then ask the coach to drill it.";
  return {
    examId: spec.id,
    title: spec.title,
    total,
    answered,
    correct,
    pct: total ? Math.round((correct / total) * 100) : 0,
    perSkill: [...bySkill.entries()].map(([skill, v]) => ({ skill, ...v })),
    items,
    verdict,
  };
}
