// Smart grading pipeline. The old grader was a string matcher: "raise" failed
// because the key said "address", a missing article failed a correct rewrite,
// "nack" failed "knack". This pipeline grades like a human examiner:
//
//   pass 1 (mechanical + fuzzy, instant): exact match -> acceptable-list match
//          -> article/punctuation tolerance -> edit-distance-1 typo tolerance.
//   pass 2 (the examiner, deep thinking): every non-settled item is judged on
//          MEANING by the model: valid synonyms, valid paraphrases, and
//          multiple-possible answers are accepted with a note; genuinely wrong
//          answers get a reason and a Farsi explanation. It also writes the
//          assessment report in the same pass.

import type {
  Exam, ExamAnswers, ExamItemResult, ExamReport, ExamQuestion,
} from "./types";

export type MatchTier = "exact" | "typo" | "accepted" | "near" | "blank";

export function norm(s: string): string {
  return s.toLowerCase().trim().replace(/[.!?,;:"'`]/g, "").replace(/\s+/g, " ");
}

function stripArticles(s: string): string {
  return norm(s).replace(/^(a|an|the)\s+/, "").replace(/\s+(a|an|the)\s+/g, " ").replace(/\s+(a|an|the)$/, "");
}

// Restricted Damerau-Levenshtein: catches substitutions, insertions,
// deletions AND transpositions (desicion~decision, nack~knack). Tolerance
// scales with length: 1 for short words, 2 for words of 8+ letters.
export function typoEq(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (!la || !lb || Math.abs(la - lb) > 2) return false;
  const tol = Math.min(la, lb) >= 8 ? 2 : 1;
  const d: number[][] = Array.from({ length: la + 1 }, () => new Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) d[i][0] = i;
  for (let j = 0; j <= lb; j++) d[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[la][lb] <= tol;
}

// Fuzzy classification of a typed answer against the key.
export function fuzzyMatch(given: string, expected: string, acceptable: string[] = []): MatchTier {
  const g = norm(given);
  if (!g) return "blank";
  const e = norm(expected);
  if (g === e) return "exact";
  if (acceptable.some((a) => norm(a) === g)) return "accepted";
  // article tolerance: "took advantage of weather" ~ "took advantage of the weather"
  if (stripArticles(g) === stripArticles(e)) return "accepted";
  if (acceptable.some((a) => stripArticles(g) === stripArticles(a))) return "accepted";
  // typo tolerance on the whole answer or per-word for multi-word answers
  if (e.length >= 4 && typoEq(g, e)) return "typo";
  if (e.length >= 4 && acceptable.some((a) => a.length >= 4 && typoEq(g, norm(a)))) return "typo";
  const gW = g.split(" "), eW = e.split(" ");
  if (gW.length === eW.length && gW.length > 1) {
    const diffs = gW.filter((w, i) => w !== eW[i]).length;
    const near = gW.every((w, i) => w === eW[i] || (eW[i].length >= 4 && typoEq(w, eW[i])));
    if (diffs === 1 && near) return "typo";
  }
  return "near";
}

// Pass 1: deterministic. Marks exact/typo/accepted; leaves "near" for pass 2.
export function quickGrade(
  exam: Omit<Exam, "id">,
  answers: ExamAnswers,
): { items: ExamItemResult[]; score: number; total: number; percent: number; near: string[] } {
  const items: ExamItemResult[] = [];
  let score = 0, total = 0;
  const near: string[] = [];
  for (const q of exam.questions) {
    const given = (answers[q.id] ?? "").trim();
    const base = { qid: q.id, section: q.section, type: q.type, q: q.q, given, expected: q.answer, why: q.why, fa: q.fa };
    if (q.type === "write") {
      items.push({ ...base, ok: false, verdict: given ? "near" : "blank" });
      near.push(q.id);
      continue;
    }
    total += q.points;
    const tier = q.type === "mcq" ? (norm(given) === norm(q.answer) ? "exact" : "near") : fuzzyMatch(given, q.answer, q.acceptable ?? []);
    const ok = tier === "exact" || tier === "typo" || tier === "accepted";
    if (ok) score += q.points;
    else near.push(q.id);
    items.push({ ...base, ok, verdict: tier });
  }
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  return { items, score, total, percent, near };
}

// ---------- pass 2: the examiner (deep thinking, one call) ----------

export interface ExaminerOutput {
  items: { qid: string; verdict: "correct" | "typo" | "wrong"; note: string; fa: string }[];
  report: ExamReport;
}

export function examinerSystem(level: string, profileJson: string): string {
  return `You are the chief examiner of Rah, an English app for Farsi speakers. The exam targeted ${level}. Learner profile: ${profileJson}.

You receive the exam (questions, answer keys with acceptable variants) and the learner's typed answers. Your job is to grade like a HUMAN examiner, not a string matcher. Think hard about every answer; a learner loses trust when a valid answer is marked wrong.

VERDICT RULES, in strict order of precedence:
1. Meaning first. If the learner's answer expresses the same thing through a legitimate synonym, near-synonym, or alternative standard collocation, verdict "correct" and note says "accepted: ...". Examples: for the key "address an issue", "raise an issue" and "tackle an issue" are correct English. For the key "knack", "nack" is a spelling slip, verdict "typo".
2. Transform/rewrite tasks: any grammatically correct rewrite that fulfills the instruction counts, even if worded differently from the key. Judge grammar and fulfillment, not wording identity.
3. Spelling slips of a correct word (edit distance 1, or a real word misspelled once): verdict "typo". It scores full credit but the note must show the standard spelling.
4. If the task explicitly demands ONE standard collocation and the learner's choice is a different word that native usage does not support in this slot, it is "wrong" with a clear reason ("intense rain" is understood, but the fixed collocation tested here is "heavy rain"). Never be harsh about phrasing the task did not test.
5. Empty or totally unrelated answers: "wrong" with note "no answer given" or the actual reason.
6. Never invent answers the learner did not give. Judge only what they typed.

For EVERY question produce one item entry: {"qid", "verdict" ("correct" | "typo" | "wrong"), "note" (one line, simple English, the human reason), "fa" (one line Farsi: why this is right or where the Farsi-speaker habit comes from)}. "typo" means full credit.

Then write the assessment report:
- band: CEFR estimate for THIS performance, one of "A2", "B1", "B2-", "B2", "B2+", "C1-", "C1". Be strict: a ${level} exam passed at 60% is ${level}-, not ${level}.
- verdict: two sentences in English about THIS exam, quoting at least one real answer of the learner. No flattery, no filler.
- strengths: up to 3 short phrases with evidence (e.g. "verb-noun collocations: met the deadline, gave advice").
- weaknesses: up to 3 short phrases with evidence.
- leaks: up to 3 Farsi-interference patterns visible in the wrong answers, each with a Farsi explanation of why it happens. Tag from: articles, countability, plurals, copula, prepositions, statives, perfect, question_order, adjectives, that_omission, collocation, register, spelling, other.
- dimensions: estimate 0 to 100 for vocabulary, grammar, reading, writing, from the per-section results.
- next_action: ONE concrete action for today (English, max 25 words), tied to the weakest dimension.
- write_eval: if the exam had a writing item, score it 0 to 10 against CEFR B2/C1 descriptors with one English note and one Farsi note; otherwise null.

Output ONE JSON object, nothing else:
{"items": [{"qid": "q1", "verdict": "correct", "note": "", "fa": ""}], "report": {"band": "", "verdict": "", "strengths": [], "weaknesses": [], "leaks": [{"trap": "", "note": "", "fa": ""}], "dimensions": {"vocabulary": 0, "grammar": 0, "reading": 0, "writing": 0}, "next_action": "", "write_eval": null}}
Never use the em dash character anywhere in your output.`;
}

export function examinerPayload(
  exam: Omit<Exam, "id">,
  answers: ExamAnswers,
  quick: ReturnType<typeof quickGrade>,
): string {
  return JSON.stringify({
    exam: { title: exam.title, spec: exam.spec, level: exam.level },
    questions: exam.questions.map((q) => ({
      qid: q.id, section: q.section, type: q.type, q: q.q.slice(0, 260),
      key: q.answer.slice(0, 120), acceptable: (q.acceptable ?? []).slice(0, 8),
      quick: quick.items.find((i) => i.qid === q.id)?.verdict ?? "near",
      given: (answers[q.id] ?? "").slice(0, 400),
    })),
    quick_score: `${quick.score}/${quick.total}`,
  });
}

export function parseExaminer(raw: unknown, quick: ReturnType<typeof quickGrade>): ExaminerOutput | null {
  const o = raw as ExaminerOutput;
  if (!o || !Array.isArray(o.items) || !o.report) return null;
  const byQid = new Map<string, ExaminerOutput["items"][number]>();
  for (const it of o.items) {
    if (it && typeof it.qid === "string") {
      byQid.set(it.qid, {
        qid: it.qid,
        verdict: it.verdict === "typo" ? "typo" : it.verdict === "wrong" ? "wrong" : "correct",
        note: typeof it.note === "string" ? it.note.slice(0, 240) : "",
        fa: typeof it.fa === "string" ? it.fa.slice(0, 240) : "",
      });
    }
  }
  if (byQid.size === 0) return null;
  const r = o.report;
  const d = (r.dimensions ?? null) as Record<string, unknown> | null;
  const dims = d && typeof d === "object" ? {
    vocabulary: clamp100(d.vocabulary),
    grammar: clamp100(d.grammar),
    reading: clamp100(d.reading),
    writing: clamp100(d.writing),
  } : null;
  return {
    items: [...byQid.values()].map((v) => ({ ...v, note: v.note.slice(0, 240) })),
    report: {
      band: typeof r.band === "string" && r.band ? r.band.slice(0, 8) : "B2",
      verdict: typeof r.verdict === "string" ? r.verdict.slice(0, 400) : "",
      strengths: arr(r.strengths, 3),
      weaknesses: arr(r.weaknesses, 3),
      leaks: Array.isArray(r.leaks) ? r.leaks.slice(0, 3).map((l) => ({
        trap: String(l?.trap ?? "other").slice(0, 24),
        note: String(l?.note ?? "").slice(0, 200),
        fa: String(l?.fa ?? "").slice(0, 300),
      })) : [],
      dimensions: dims,
      next_action: typeof r.next_action === "string" ? r.next_action.slice(0, 160) : "",
      write_eval: r.write_eval && typeof r.write_eval === "object" && r.write_eval !== null ? {
        score: Math.max(0, Math.min(10, Math.round(Number((r.write_eval as any).score) || 0))),
        note: String((r.write_eval as any).note ?? "").slice(0, 300),
        fa: String((r.write_eval as any).fa ?? "").slice(0, 300),
      } : null,
    },
  };
  function arr(v: unknown, n: number): string[] {
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).slice(0, 80)).slice(0, n) : [];
  }
  function clamp100(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  }
}

// Merge the examiner's verdicts into quick results and compute the final score.
export function finalize(
  quick: ReturnType<typeof quickGrade>,
  out: ExaminerOutput,
): { items: ExamItemResult[]; score: number; total: number; percent: number } {
  const j = new Map(out.items.map((i) => [i.qid, i]));
  const items: ExamItemResult[] = quick.items.map((it): ExamItemResult => {
    const jd = j.get(it.qid);
    if (it.type === "write") {
      const we = out.report.write_eval;
      return {
        ...it,
        verdict: jd?.verdict === "wrong" ? "wrong" : givenVerdict(it.given),
        note: jd?.note || we?.note || it.why,
        fa: it.fa || jd?.fa || "",
      };
    }
    if (!jd) return it; // keep quick verdict
    if (jd.verdict === "wrong") return { ...it, ok: false, verdict: "wrong", note: jd.note, fa: jd.fa || it.fa };
    // Examiner says correct: keep the more precise quick tier when we have one
    // (exact stays exact; only meaning-based acceptances become "accepted").
    const tier = it.verdict === "exact" || it.verdict === "typo" || it.verdict === "accepted" ? it.verdict : jd.verdict === "typo" ? "typo" : "accepted";
    return { ...it, ok: true, verdict: tier, note: jd.note, fa: jd.fa || it.fa };
  });
  let score = 0, total = 0;
  for (const it of items) {
    const q = exam_points(it.qid);
    if (it.type === "write") {
      total += q;
      const ws = out.report.write_eval?.score ?? 0;
      score += Math.round((ws / 10) * q);
      continue;
    }
    total += q;
    if (it.ok) score += q;
  }
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  return { items, score, total, percent };
  function givenVerdict(g: string): ExamItemResult["verdict"] { return g.trim() ? "accepted" : "blank"; }
  function exam_points(_qid: string): number { return _POINTS.get(_qid) ?? 1; }
}

// points map is injected by the submit route (write items weigh 5).
let _POINTS = new Map<string, number>();
export function setPointsMap(qs: ExamQuestion[]) {
  _POINTS = new Map(qs.map((q) => [q.id, q.points]));
}

// ---------- last-resort mechanical report (only if the examiner call fails) ----------

export function mechanicalReport(
  exam: Omit<Exam, "id">,
  quick: ReturnType<typeof quickGrade>,
): ExamReport {
  const bySection: Record<string, { ok: number; n: number }> = {};
  for (const it of quick.items) {
    if (it.type === "write") continue;
    bySection[it.section] ??= { ok: 0, n: 0 };
    bySection[it.section].n += 1;
    if (it.ok) bySection[it.section].ok += 1;
  }
  const ranked = Object.entries(bySection).map(([s, a]) => ({ s, r: a.ok / a.n, n: a.n })).sort((a, b) => b.r - a.r);
  const missed = quick.items.filter((i) => !i.ok && i.type !== "write");
  const band = quick.percent >= 92 ? "C1" : quick.percent >= 82 ? "C1-" : quick.percent >= 72 ? exam.level + "+" : quick.percent >= 58 ? exam.level : quick.percent >= 40 ? exam.level + "-" : "B1";
  const weakest = ranked[ranked.length - 1]?.s ?? "vocabulary";
  return {
    band,
    verdict: `${quick.score} of ${quick.total} correct at ${exam.level} level. Strongest section: ${ranked[0]?.s ?? "n/a"}; weakest: ${weakest}.`,
    strengths: ranked.slice(0, 2).filter((x) => x.r > 0).map((x) => x.s),
    weaknesses: ranked.slice(-2).reverse().map((x) => x.s),
    leaks: missed.slice(0, 3).map((m) => ({ trap: "other", note: m.expected ? `Key: ${m.expected}` : "review", fa: m.fa || "پاسخ درست را با معنایش مرور کن." })),
    dimensions: {
      vocabulary: pctOf("Vocabulary"), grammar: pctOf("Grammar"), reading: pctOf("Reading"), writing: pctOf("Writing"),
    },
    next_action: `Drill ${weakest.toLowerCase()} today, then retake a ${exam.level} exam this week.`,
    write_eval: null,
  };
  function pctOf(name: string): number {
    const e = ranked.find((x) => x.s.toLowerCase().includes(name.toLowerCase()));
    return e ? Math.round(e.r * 100) : 0;
  }
}
