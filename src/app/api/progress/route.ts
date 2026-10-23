import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { cardById, DECK } from "@/lib/content";
import { diagnose } from "@/lib/server";
import { getSkillLevels } from "@/lib/agent/levels";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = dayIndex();
  const u = await contentUserId().catch(() => "me");
  // Task 89 perf: this route used to await eight queries in sequence (~140ms
  // in dev). None of them depends on another's result, so they go out as one
  // parallel batch. diagnose() keeps its own internals.
  const [stats, states, diag, writes, speaks, totalReviews, totalLapses, skillLevels, learner, gradedExams] = await Promise.all([
    db.dailyStat.findMany({ where: { userId: u, day: { gte: today - 34 } } }),
    db.cardState.findMany({ where: { userId: u } }),
    diagnose(),
    db.writingSub.findMany({ where: { userId: u }, orderBy: { id: "desc" }, take: 6 }),
    db.speakSession.findMany({ where: { userId: u }, orderBy: { id: "desc" }, take: 6 }),
    db.reviewLog.count({ where: { userId: u } }),
    db.reviewLog.count({ where: { userId: u, grade: 1 } }),
    getSkillLevels(),
    db.learner.findUnique({ where: { id: "me" } }),
    db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const statMap = new Map(stats.map((s) => [s.day, s]));
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = today - 34 + i;
    const s = statMap.get(d);
    return { day: d, reviews: s?.reviews ?? 0, correct: s?.correct ?? 0, xp: s?.xp ?? 0 };
  });

  const byUnit: Record<string, { total: number; started: number; mature: number }> = {};
  for (const c of DECK) {
    byUnit[c.unit] ??= { total: 0, started: 0, mature: 0 };
    byUnit[c.unit].total += 1;
  }
  for (const st of states) {
    const c = cardById(st.cardId);
    if (!c || st.state === "new") continue;
    byUnit[c.unit].started += 1;
    if (st.s >= 21) byUnit[c.unit].mature += 1;
  }

  // Task 89 (the review's P1-4 ask): the weekly pilot needs WRITING, SPEAKING
  // and DICTATION volume, not just first attempts - the DailyStat ledger
  // already counts them, so the rollup costs zero extra queries. last7 is the
  // week-N report row; last28 is the trend the multi-week study reads.
  const sumVol = (from: number, to: number) => {
    let reviews = 0,
      written = 0,
      spoken = 0,
      listened = 0;
    for (const s of stats)
      if (s.day >= from && s.day <= to) {
        reviews += s.reviews;
        written += s.written;
        spoken += s.spoken;
        listened += s.listened;
      }
    return { reviews, written, spoken, listened };
  };
  const volume = { last7: sumVol(today - 6, today), last28: sumVol(today - 27, today) };

  const writeTrend = writes
    .map((w) => {
      try {
        const r = JSON.parse(w.result) as { scores: Record<string, number> };
        const avg = Math.round(((r.scores.task + r.scores.organization + r.scores.range + r.scores.accuracy) / 4) * 10) / 10;
        return { at: w.at, avg };
      } catch {
        return null;
      }
    })
    .filter((x): x is { at: Date; avg: number } => !!x)
    .reverse();

  const speakTrend = speaks
    .map((s) => {
      try {
        const r = JSON.parse(s.result) as { scores: Record<string, number> };
        const avg = Math.round(((r.scores.fluency + r.scores.range + r.scores.accuracy + r.scores.delivery) / 4) * 10) / 10;
        return { at: s.at, avg };
      } catch {
        return null;
      }
    })
    .filter((x): x is { at: Date; avg: number } => !!x)
    .reverse();

  // P5: the CEFR band map's evidence, computed from real rows only - the
  // engine decides what is proven, nothing here asks the AI. A band is
  // PROVEN when a measured skill sits at that level or a recent graded exam
  // targeted it; otherwise the band is honestly unproven.
  // (learner + gradedExams arrive in the parallel batch above.)
  const examByBand: Record<string, { graded: number; passed: number; bestPct: number }> = {};
  for (const e of gradedExams) {
    try {
      const spec = JSON.parse(e.spec) as { level?: string };
      const result = JSON.parse(e.result ?? "{}") as { pct?: number };
      const band = String(spec.level ?? "?").toUpperCase();
      if (!band) continue;
      examByBand[band] ??= { graded: 0, passed: 0, bestPct: 0 };
      examByBand[band].graded += 1;
      if ((result.pct ?? 0) >= 60) examByBand[band].passed += 1;
      examByBand[band].bestPct = Math.max(examByBand[band].bestPct, result.pct ?? 0);
    } catch {
      // malformed spec: skip that exam's band evidence
    }
  }
  const BANDS = ["A1", "A2", "B1", "B2", "C1"] as const;
  const bands = BANDS.map((band) => {
    const skills = skillLevels.filter((s) => s.level === band).map((s) => ({ skill: s.skill, score: s.score, samples: s.samples }));
    const exams = examByBand[band] ?? { graded: 0, passed: 0, bestPct: 0 };
    return { band, skills, exams, proven: skills.length > 0 || exams.graded > 0 };
  });

  return NextResponse.json({
    days,
    byUnit: Object.entries(byUnit).map(([unit, u]) => ({ unit, ...u })),
    bySkill: diag.bySkill,
    advice: diag.advice,
    writeTrend,
    speakTrend,
    skillLevels,
    bands,
    volume,
    placementBand: learner?.level ?? "?",
    totals: {
      reviews: totalReviews,
      lapses: totalLapses,
      cards: DECK.length,
      started: states.filter((s) => s.state !== "new").length,
    },
  });
}
