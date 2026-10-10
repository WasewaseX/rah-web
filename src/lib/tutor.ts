// Tutor Skills Hub engine: evidence aggregation and mechanical grading.
// The AI narrates; this module decides the facts.

import { db } from "@/lib/db";
import { cardById } from "@/lib/content";
import { dayIndex } from "@/lib/fsrs";
import { getLearner } from "@/lib/server";

export interface ExamItem {
  type: "mcq" | "cloze" | "short";
  skill: string;
  q: string;
  choices: string[];
  a: string;
  why: string;
  fa: string;
}

// ---------- evidence for the deep scan ----------

export async function collectEvidence() {
  const learner = await getLearner();
  const today = dayIndex();

  // 1. Spaced repetition: accuracy per skill + lapse inventory.
  const states = await db.cardState.findMany();
  const bySkill: Record<string, { reps: number; lapses: number }> = {};
  const lapseTraps: Record<string, number> = {};
  let seenCards = 0;
  for (const st of states) {
    if (st.state === "new") continue;
    seenCards += 1;
    const c = cardById(st.cardId);
    if (!c) continue;
    bySkill[c.skill] ??= { reps: 0, lapses: 0 };
    bySkill[c.skill].reps += st.reps;
    bySkill[c.skill].lapses += st.lapses;
    if (st.lapses > 0) for (const t of c.traps) lapseTraps[t] = (lapseTraps[t] ?? 0) + st.lapses;
  }

  // 2. Coach corrections: trap-tag frequency from stored envelopes.
  const coachMsgs = await db.chatMsg.findMany({ where: { role: "coach" }, orderBy: { id: "desc" }, take: 120 });
  const chatTraps: Record<string, number> = {};
  let correctionCount = 0;
  const sampleCorrections: string[] = [];
  for (const m of coachMsgs) {
    try {
      const parsed = JSON.parse(m.content) as {
        corrections?: { wrong: string; right: string; trap?: string }[];
      };
      for (const c of parsed.corrections ?? []) {
        correctionCount += 1;
        if (c.trap && c.trap !== "none") chatTraps[c.trap] = (chatTraps[c.trap] ?? 0) + 1;
        if (sampleCorrections.length < 12) sampleCorrections.push(`${c.wrong} -> ${c.right}`);
      }
    } catch {
      // legacy plain rows
    }
  }

  // 3. Writing history: dimension scores + top error types.
  const writes = await db.writingSub.findMany({ orderBy: { id: "desc" }, take: 12 });
  const writeScores: Record<string, number[]> = { task: [], organization: [], range: [], accuracy: [] };
  const writeLevels: string[] = [];
  for (const w of writes) {
    try {
      const r = JSON.parse(w.result) as {
        level?: string;
        scores?: Record<string, number>;
        errors?: { type?: string; bad: string; good: string }[];
      };
      if (r.level) writeLevels.push(r.level);
      for (const k of Object.keys(writeScores)) if (r.scores?.[k]) writeScores[k].push(r.scores[k]);
      for (const e of r.errors ?? []) {
        if (sampleCorrections.length < 20) sampleCorrections.push(`${e.bad} -> ${e.good}`);
      }
    } catch {
      // ignore malformed rows
    }
  }

  // 4. Speaking history.
  const speaks = await db.speakSession.findMany({ orderBy: { id: "desc" }, take: 12 });
  const speakScores: Record<string, number[]> = { fluency: [], range: [], accuracy: [], delivery: [] };
  for (const s of speaks) {
    try {
      const r = JSON.parse(s.result) as { scores?: Record<string, number> };
      for (const k of Object.keys(speakScores)) if (r.scores?.[k]) speakScores[k].push(r.scores[k]);
    } catch {
      // ignore
    }
  }

  // 5. Placement + consistency + activity mix.
  const placement = await db.placement.findUnique({ where: { id: "main" } });
  const days = await db.dailyStat.findMany({ orderBy: { day: "desc" }, take: 28 });
  const activeDays = days.filter((d) => d.reviews > 0 || d.written > 0 || d.spoken > 0 || d.listened > 0).length;
  const totalReviews = days.reduce((a, d) => a + d.reviews, 0);
  const totalCorrect = days.reduce((a, d) => a + d.correct, 0);
  const dueNow = await db.cardState.count({ where: { state: { not: "new" }, due: { lte: today }, suspended: false } });

  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  return {
    placement: placement
      ? { level: placement.level, writingLevel: placement.writingLevel, phase: placement.phase }
      : null,
    learner: { level: learner.level === "?" ? null : learner.level, streak: learner.streak, activeDays28: activeDays },
    srs: {
      seenCards,
      dueNow,
      bySkill: Object.fromEntries(Object.entries(bySkill).map(([k, v]) => [k, { reps: v.reps, lapseRate: v.reps ? v.lapses / v.reps : 0 }])),
      accuracy28: totalReviews ? totalCorrect / totalReviews : null,
    },
    traps: { chat: chatTraps, srs: lapseTraps, correctionCount },
    writing: {
      count: writes.length,
      levels: writeLevels,
      avgScores: Object.fromEntries(Object.entries(writeScores).map(([k, v]) => [k, avg(v)])),
    },
    speaking: {
      count: speaks.length,
      avgScores: Object.fromEntries(Object.entries(speakScores).map(([k, v]) => [k, avg(v)])),
    },
    sampleCorrections,
  };
}

// ---------- mechanical grading ----------

export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:"'`()\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Grade one learner answer against `a` which may hold alternatives "a|b|c".
export function gradeAnswer(item: ExamItem, picked: string): boolean {
  const p = normText(picked ?? "");
  if (!p) return false;
  if (item.type === "mcq") return normText(picked) === normText(item.a);
  const alts = item.a.split("|").map(normText).filter(Boolean);
  return alts.some((alt) => alt === p);
}

export interface GradedItem {
  idx: number;
  ok: boolean;
  picked: string;
  right: string;
}

export function gradeExam(items: ExamItem[], answers: string[]): { graded: GradedItem[]; score: number; perSkill: Record<string, { ok: number; total: number }> } {
  const graded: GradedItem[] = [];
  const perSkill: Record<string, { ok: number; total: number }> = {};
  items.forEach((item, i) => {
    const ok = gradeAnswer(item, answers[i] ?? "");
    graded.push({ idx: i, ok, picked: answers[i] ?? "", right: item.a });
    perSkill[item.skill] ??= { ok: 0, total: 0 };
    perSkill[item.skill].total += 1;
    if (ok) perSkill[item.skill].ok += 1;
  });
  const score = graded.filter((g) => g.ok).length;
  return { graded, score, perSkill };
}

// Local fallback assessment when the AI assessor is unreachable: the numbers
// are still real, only the narrative is canned.
export function fallbackAssessment(score: number, total: number, perSkill: Record<string, { ok: number; total: number }>) {
  const pct = total ? score / total : 0;
  const band = pct >= 0.9 ? "C1" : pct >= 0.75 ? "B2+" : pct >= 0.55 ? "B2" : pct >= 0.35 ? "B1" : "A2";
  return {
    band,
    verdict: `You answered ${score} of ${total} correctly, which puts this run at ${band} level on this exam kind.`,
    strengths: Object.entries(perSkill)
      .filter(([, v]) => v.ok / v.total >= 0.7)
      .map(([k, v]) => `${k}: ${v.ok}/${v.total} correct`),
    weaknesses: Object.entries(perSkill)
      .filter(([, v]) => v.ok / v.total < 0.5)
      .map(([k, v]) => `${k}: ${v.ok}/${v.total} correct, drill this next`),
    errors: [] as { point: string; picked: string; right: string; fa: string }[],
    prescription: ["Review the lapsing cards before retaking", "Ask the Coach for a drill on your weakest section"],
  };
}
