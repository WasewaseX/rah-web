import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, planSystem } from "@/lib/ai";
import { getLearner, dueCount } from "@/lib/server";
import { dayIndex } from "@/lib/fsrs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface PlanReport {
  goal: string;
  days: { day: number; focus: string; tasks: { text: string; minutes: number }[] }[];
}

export async function GET() {
  const row = await db.tutorReport.findFirst({ where: { kind: "plan" }, orderBy: { at: "desc" } });
  return NextResponse.json(row ? JSON.parse(row.data) : null);
}

export async function POST() {
  const l = await getLearner();
  const level = l.level === "?" ? "B2" : l.level;
  const due = await dueCount();
  const today = dayIndex();

  // Latest scan drives the plan; without one the stats speak for themselves.
  const scanRow = await db.tutorReport.findFirst({ where: { kind: "scan" }, orderBy: { at: "desc" } });
  const scan = scanRow ? compactScan(scanRow.data) : null;
  const days = await db.dailyStat.findMany({ orderBy: { day: "desc" }, take: 7 });
  const context = {
    level,
    due,
    streak: l.streak,
    dailyGoal: l.dailyGoal,
    last7: days.map((d) => ({ day: d.day - today, reviews: d.reviews, written: d.written, spoken: d.spoken })),
    scan: scan
      ? {
          band: scan.band,
          weaknesses: (scan.weaknesses ?? []).slice(0, 3),
          actions: (scan.actions ?? []).slice(0, 4),
        }
      : null,
  };

  let plan: PlanReport;
  try {
    plan = await aiJson<PlanReport>(planSystem(level), [
      { role: "user", content: "Context:\n" + JSON.stringify(context) + "\n\nProduce the 7-day plan JSON now." },
    ]);
  } catch (e) {
    return NextResponse.json({ error: `Plan failed: ${(e as Error).message}` }, { status: 502 });
  }

  await db.tutorReport.create({ data: { kind: "plan", data: JSON.stringify(plan) } });
  const old = await db.tutorReport.findMany({ where: { kind: "plan" }, orderBy: { at: "desc" }, skip: 5 });
  for (const o of old) await db.tutorReport.delete({ where: { id: o.id } });

  return NextResponse.json(plan);
}

function compactScan(data: string): { band?: string; weaknesses?: { point: string; fix: string }[]; actions?: string[] } | null {
  try {
    const r = JSON.parse(data) as { band?: string; weaknesses?: { point: string; fix: string }[]; actions?: string[] };
    return { band: r.band, weaknesses: r.weaknesses, actions: r.actions };
  } catch {
    return null;
  }
}
