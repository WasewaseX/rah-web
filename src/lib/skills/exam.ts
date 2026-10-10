// Exam skill: design, write, verify, and grade exams. The verification pass
// exists because a question that argues with the learner costs trust; every
// item is stress-tested before the learner ever sees it. Grading never marks
// a correct answer wrong: fuzzy matching first, deep review for the rest.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import type { ProfileJson } from "@/lib/ai";
import { matchShort } from "./grading";
import {
  examBlueprintSystem,
  examWriteSystem,
  examVerifySystem,
  openGradeSystem,
} from "./prompts";
import type { Exam, ExamQuestion, ExamResult, GradedQuestion } from "./types";

interface RawItem {
  type?: string;
  skill?: string;
  prompt?: string;
  choices?: string[] | null;
  accept?: string[];
  point?: string;
  fa?: string;
  why?: string;
}

const SKILLS = new Set([
  "grammar", "vocabulary", "collocation", "prepositions", "tenses", "articles",
  "countability", "phrasal", "register", "reading", "writing", "wordform",
]);

function clean(s: string): string {
  return s.replace(/\s*[—–]\s*/g, ", ").trim();
}

export function parseCount(message: string, fallback: number): number {
  const m = message.match(/\b(\d{1,2})\s*(questions?|items?|qs)?\b/);
  const n = m ? parseInt(m[1], 10) : NaN;
  if (!Number.isNaN(n) && n >= 3 && n <= 12) return n;
  return fallback;
}

// Local normalization before the learner sees the exam: guaranteed counts,
// guaranteed answer keys, no duplicates, no broken types.
function normalizeItems(raw: RawItem[], wantCount: number): ExamQuestion[] {
  const seen = new Set<string>();
  const out: ExamQuestion[] = [];
  let i = 0;
  for (const item of raw) {
    if (out.length >= wantCount) break;
    const type = ["mcq", "cloze", "rewrite", "translate"].includes(item.type ?? "")
      ? (item.type as ExamQuestion["type"])
      : "cloze";
    const prompt = clean(String(item.prompt ?? "")).slice(0, 400);
    if (!prompt || prompt.length < 8) continue;
    const key = prompt.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);

    let accept = (item.accept ?? []).map((a) => clean(String(a))).filter(Boolean);
    let choices = type === "mcq" ? (item.choices ?? []).map((c) => clean(String(c))).filter(Boolean) : undefined;

    if (type === "mcq") {
      if (!choices || choices.length < 2) continue;
      if (!accept.length) continue;
      // the canonical answer must be among the choices; otherwise drop the item
      if (!choices.some((c) => c.toLowerCase() === accept[0].toLowerCase())) continue;
      choices = choices.slice(0, 4);
      // keep the canonical answer exactly as the choice text
      accept[0] = choices.find((c) => c.toLowerCase() === accept[0].toLowerCase())!;
    } else if (!accept.length) {
      continue; // a productive item with no key cannot be graded fairly
    }

    out.push({
      id: `q${++i}`,
      type,
      skill: SKILLS.has(item.skill ?? "") ? (item.skill as ExamQuestion["skill"]) : "grammar",
      prompt,
      choices: choices && choices.length ? choices : undefined,
      accept: accept.slice(0, 5),
      point: clean(String(item.point ?? "")).slice(0, 80) || "target pattern",
      fa: clean(String(item.fa ?? "")).slice(0, 160),
      why: clean(String(item.why ?? "")).slice(0, 240),
    });
  }
  return out;
}

export interface ExamCtx {
  profile: ProfileJson;
  emit: (step: { label: string; state: "run" | "done"; detail?: string }) => void;
}

export async function buildExam(message: string, ctx: ExamCtx): Promise<Exam> {
  const quick = /\b(quick|short|fast|mini|5)\b/i.test(message);
  const wantCount = parseCount(message, quick ? 5 : 8);

  ctx.emit({ label: "Reading your recent work", state: "run" });
  const traps = ctx.profile.recentTraps.join(", ") || "none recorded";
  const weak = ctx.profile.weakSkills.join(", ") || "none recorded";
  ctx.emit({ label: "Reading your recent work", state: "done", detail: `level ${ctx.profile.level}, leaks: ${traps}` });

  ctx.emit({ label: "Designing the exam", state: "run" });
  const blueprint = await aiJson<{ sections: RawItem[] }>(
    examBlueprintSystem(ctx.profile, wantCount, quick ? "short and punchy" : "full coverage"),
    [{ role: "user", content: message || "Build me an exam." }],
  );
  const sections = Array.isArray(blueprint.sections) ? blueprint.sections : [];
  ctx.emit({ label: "Designing the exam", state: "done", detail: `${wantCount} items across your weak spots` });

  ctx.emit({ label: "Writing the questions", state: "run" });
  const written = await aiJson<{ items: RawItem[] }>(
    examWriteSystem(ctx.profile, JSON.stringify(sections)),
    [{ role: "user", content: "Write the items now." }],
  );
  let items = normalizeItems(Array.isArray(written.items) ? written.items : [], wantCount);
  ctx.emit({ label: "Writing the questions", state: "done", detail: `${items.length} items drafted` });

  ctx.emit({ label: "Checking every question", state: "run" });
  if (items.length >= 3) {
    try {
      const reviewed = await aiJson<{ items: RawItem[] }>(
        examVerifySystem(JSON.stringify(items)),
        [{ role: "user", content: "Review and fix." }],
        undefined,
        { deep: true },
      );
      const fixed = normalizeItems(Array.isArray(reviewed.items) ? reviewed.items : [], wantCount);
      // only take the reviewed set if it survived intact
      if (fixed.length >= Math.min(items.length, wantCount - 1)) items = fixed;
    } catch {
      // verification is a quality pass, not a gate; the drafted items stand
    }
  }
  ctx.emit({ label: "Checking every question", state: "done", detail: "keys, distractors, Farsi lines verified" });

  ctx.emit({ label: "Final checks", state: "run" });
  const exam: Exam = {
    id: `ex${Date.now().toString(36)}`,
    title: quick ? "Quick Check" : "Exam",
    targetLevel: ctx.profile.level,
    questions: items,
    builtAt: Date.now(),
  };
  await db.quizItem.create({ data: { src: "exam", quiz: JSON.stringify(exam) } });
  ctx.emit({ label: "Final checks", state: "done", detail: `${items.length} questions ready` });
  return exam;
}

// ---------- grading ----------

interface OpenGrade {
  id: string;
  verdict?: string;
  note?: string;
  fa?: string;
}

export async function gradeExam(exam: Exam, answers: Record<string, string>, ctx: ExamCtx): Promise<ExamResult> {
  const questions = exam.questions;

  ctx.emit({ label: "Checking your answers", state: "run" });
  const graded = new Map<string, GradedQuestion>();
  const openIds: string[] = [];

  for (const q of questions) {
    const given = (answers[q.id] ?? "").trim();
    if (!given) {
      graded.set(q.id, {
        id: q.id, verdict: "skipped", given: "", key: q.accept[0],
        note: "Left empty.", fa: "",
      });
      continue;
    }
    if (q.type === "mcq") {
      const pick = q.choices?.find((c) => c.toLowerCase() === given.toLowerCase());
      const ok = pick && pick.toLowerCase() === q.accept[0].toLowerCase();
      graded.set(q.id, {
        id: q.id, verdict: ok ? "correct" : "wrong", given: pick ?? given, key: q.accept[0],
        note: ok ? "" : "", fa: "",
      });
      continue;
    }
    if (q.type === "cloze") {
      const m = matchShort(given, q.accept, { articlesMatter: q.skill === "articles" });
      graded.set(q.id, {
        id: q.id, verdict: m.verdict, given, key: q.accept[0],
        alsoAccepted: m.matched && m.verdict === "correct" && m.matched !== q.accept[0] ? [m.matched] : undefined,
        note: m.note, fa: "",
      });
      // a fuzzy miss on a cloze deserves a second, deeper look
      if (m.verdict === "wrong" || m.verdict === "close") openIds.push(q.id);
      continue;
    }
    // rewrite / translate: always deep-graded
    graded.set(q.id, {
      id: q.id, verdict: "wrong", given, key: q.accept[0], note: "", fa: "",
    });
    openIds.push(q.id);
  }
  ctx.emit({ label: "Checking your answers", state: "done", detail: `${questions.length - openIds.length} settled locally` });

  if (openIds.length > 0) {
    ctx.emit({ label: "Reading your answers closely", state: "run" });
    const payload = openIds
      .map((id) => {
        const q = questions.find((x) => x.id === id)!;
        return {
          id, type: q.type, prompt: q.prompt, target: q.accept,
          point: q.point, learner_wrote: (answers[id] ?? "").trim(),
        };
      });
    try {
      const res = await aiJson<{ grades: OpenGrade[] }>(
        openGradeSystem(exam.targetLevel),
        [{ role: "user", content: JSON.stringify(payload) }],
        undefined,
        { deep: true },
      );
      for (const g of res.grades ?? []) {
        const cur = graded.get(g.id);
        if (!cur) continue;
        const v = g.verdict === "correct" || g.verdict === "close" ? g.verdict : "wrong";
        // the deep grader may only keep or upgrade a locally-wrong verdict, and
        // must explain itself whenever it changes anything
        cur.verdict = v;
        cur.note = clean(String(g.note ?? cur.note)).slice(0, 240);
        cur.fa = clean(String(g.fa ?? "")).slice(0, 200);
      }
    } catch {
      // local verdicts stand
    }
    ctx.emit({ label: "Reading your answers closely", state: "done", detail: `${openIds.length} open answers weighed` });
  }

  ctx.emit({ label: "Adding it up", state: "run" });
  const list = questions.map((q) => graded.get(q.id)!);
  const score = list.filter((g) => g.verdict === "correct").length;
  const closeCount = list.filter((g) => g.verdict === "close").length;
  const total = questions.length;
  const percent = total ? Math.round(((score + closeCount * 0.5) / total) * 100) : 0;

  const perSkillMap = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const row = perSkillMap.get(q.skill) ?? { correct: 0, total: 0 };
    row.total += 1;
    const g = graded.get(q.id)!;
    if (g.verdict === "correct" || g.verdict === "close") row.correct += 1;
    perSkillMap.set(q.skill, row);
  }
  const perSkill = [...perSkillMap.entries()].map(([skill, r]) => ({ skill, ...r }));

  const misses = list.filter((g) => g.verdict === "wrong" || g.verdict === "close");
  const missedSkills = [...new Set(misses.map((g) => questions.find((q) => q.id === g.id)!.skill))];

  // Verdict and next move come from a grader that saw the actual answers, so
  // the summary talks about what happened, not about a template.
  let verdict = "";
  let next = "";
  let signal = "";
  try {
    const summary = await aiJson<{ verdict: string; next: string; signal: string }>(
      `${openGradeSystem(exam.targetLevel)}

Now write the closing summary. Ground every sentence in the actual results. No generic study advice, no lists. verdict: what they actually did (name real wins and real misses with their words). next: the single most useful move, tied to a specific pattern that wobbled. signal: one clause on what this says about their current level. Never use the em dash character anywhere.

Reply with ONE JSON object: {"verdict":"2-3 sentences","next":"one sentence","signal":"one clause"}`,
      [{
        role: "user",
        content: JSON.stringify({
          score, closeCount, total,
          strong: perSkill.filter((s) => s.correct === s.total).map((s) => s.skill),
          missedSkills,
          misses: misses.map((m) => ({
            point: questions.find((q) => q.id === m.id)!.point,
            wrote: m.given.slice(0, 120),
            wanted: m.key,
            note: m.note.slice(0, 140),
          })),
        }),
      }],
      undefined,
      { deep: true },
    );
    verdict = clean(summary.verdict ?? "");
    next = clean(summary.next ?? "");
    signal = clean(summary.signal ?? "");
  } catch {
    const strong = perSkill.filter((s) => s.correct === s.total).map((s) => s.skill);
    verdict = `${score} of ${total} settled${closeCount ? `, ${closeCount} more landed with a slip` : ""}. ${
      strong.length ? `Steady on ${strong.join(" and ")}.` : ""
    }`;
    next = missedSkills.length ? `The wobble is in ${missedSkills.join(" and ")}: drill that next.` : "Keep the streak going.";
    signal = `${percent}% on ${exam.targetLevel} material`;
  }
  ctx.emit({ label: "Adding it up", state: "done", detail: `${score}/${total}${closeCount ? ` (+${closeCount} close)` : ""}` });

  return {
    examId: exam.id, title: exam.title, score, total, percent, closeCount,
    perSkill, signal, verdict, next,
    questions: list,
  };
}
