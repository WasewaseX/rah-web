import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { cardById, DECK } from "@/lib/content";
import { diagnose } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = dayIndex();
  const stats = await db.dailyStat.findMany({ where: { day: { gte: today - 34 } } });
  const statMap = new Map(stats.map((s) => [s.day, s]));
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = today - 34 + i;
    const s = statMap.get(d);
    return { day: d, reviews: s?.reviews ?? 0, xp: s?.xp ?? 0 };
  });

  const states = await db.cardState.findMany();
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

  const diag = await diagnose();
  const writes = await db.writingSub.findMany({ orderBy: { id: "desc" }, take: 6 });
  const speaks = await db.speakSession.findMany({ orderBy: { id: "desc" }, take: 6 });

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

  const totalReviews = await db.reviewLog.count();
  const totalLapses = await db.reviewLog.count({ where: { grade: 1 } });

  return NextResponse.json({
    days,
    byUnit: Object.entries(byUnit).map(([unit, u]) => ({ unit, ...u })),
    bySkill: diag.bySkill,
    advice: diag.advice,
    writeTrend,
    speakTrend,
    totals: {
      reviews: totalReviews,
      lapses: totalLapses,
      cards: DECK.length,
      started: states.filter((s) => s.state !== "new").length,
    },
  });
}
