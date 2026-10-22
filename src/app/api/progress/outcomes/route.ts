import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// OUTCOMES (the 7.4/10 review's lowest score: "proven learning effectiveness
// 4.5/10"). Engineering test pass-rates do not measure learning - but the
// engine already earns the real numbers on every retrieval. This route is the
// deterministic read that surfaces them honestly: first-attempt retention from
// ReviewLog, interval growth (FSRS stability proxy) over time, mature-memory
// share, and mistake-family extinction. No AI, no vibes - SQL and math.

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(m * 10) / 10;
};

export async function GET() {
  const today = dayIndex();
  const window = 30;
  const u = await contentUserId().catch(() => "me");

  // 1) First-attempt retention: share of retrievals graded Good/Easy per day.
  const logs = await db.reviewLog.findMany({
    where: { userId: u, day: { gte: today - window } },
    select: { day: true, grade: true },
  });
  const byDay = new Map<number, { total: number; good: number }>();
  for (const l of logs) {
    const e = byDay.get(l.day) ?? { total: 0, good: 0 };
    e.total += 1;
    if (l.grade >= 3) e.good += 1;
    byDay.set(l.day, e);
  }
  const retention = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, v]) => ({
      day,
      reviews: v.total,
      goodRate: Math.round((v.good / v.total) * 1000) / 10, // percent, 1dp
    }));

  // 2) Stability proxy: median scheduled interval of retrievals per day -
  // rising intervals mean FSRS trusts the memory more (stability growth).
  const ivlLogs = await db.reviewLog.findMany({
    where: { userId: u, day: { gte: today - window } },
    select: { day: true, ivl: true },
  });
  const ivlByDay = new Map<number, number[]>();
  for (const l of ivlLogs) {
    let arr = ivlByDay.get(l.day);
    if (!arr) {
      arr = [];
      ivlByDay.set(l.day, arr);
    }
    arr.push(l.ivl);
  }
  const stability = [...ivlByDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, ivls]) => ({ day, medianIvl: median(ivls) }));

  // 3) Mature memory: how much of the started deck has crossed s >= 21d.
  const states = await db.cardState.findMany({ where: { userId: u } });
  const started = states.filter((s) => s.state !== "new");
  const mature = started.filter((s) => s.s >= 21);
  const memory = {
    started: started.length,
    mature: mature.length,
    matureShare: started.length ? Math.round((mature.length / started.length) * 1000) / 10 : 0,
    medianStability: median(started.map((s) => s.s)),
    lapsingCards: started.filter((s) => s.lapses > 0).length,
  };

  // 4) Mistake-family extinction: how many persistent error families the
  // healing loop has retired (2 clean exam hits) vs still active.
  const fams = await db.mistakeFamily.findMany({ where: { userId: u }, select: { kind: true, resolvedAt: true, count: true } });
  const families = {
    total: fams.length,
    active: fams.filter((f) => !f.resolvedAt).length,
    resolved: fams.filter((f) => f.resolvedAt).length,
    retirementRate: fams.length ? Math.round((fams.filter((f) => f.resolvedAt).length / fams.length) * 1000) / 10 : 0,
    byKind: fams.reduce<Record<string, { total: number; resolved: number }>>((acc, f) => {
      acc[f.kind] ??= { total: 0, resolved: 0 };
      acc[f.kind].total += 1;
      if (f.resolvedAt) acc[f.kind].resolved += 1;
      return acc;
    }, {}),
  };

  // 5) Recent-window summary the UI can quote verbatim.
  const recent = retention.slice(-7);
  const overallGoodRate = retention.length
    ? Math.round((retention.reduce((a, r) => a + r.goodRate, 0) / retention.length) * 10) / 10
    : 0;

  return NextResponse.json({
    retention,
    stability,
    memory,
    families,
    summary: {
      days: retention.length,
      overallGoodRate,
      last7GoodRate: recent.length
        ? Math.round((recent.reduce((a, r) => a + r.goodRate, 0) / recent.length) * 10) / 10
        : 0,
      ivlTrend:
        stability.length >= 2
          ? Math.round((stability[stability.length - 1].medianIvl - stability[0].medianIvl) * 10) / 10
          : 0,
    },
  });
}
