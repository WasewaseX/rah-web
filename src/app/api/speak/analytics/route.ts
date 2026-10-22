import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// SPEAK RE wave (speak.com teardown): their loop is learn -> practice -> apply
// with MEASURED improvement between attempts - "how did round 2 beat round 1".
// The engine already persists every SpeakSession and every spoken-error family;
// this route is the deterministic read that turns those rows into honest
// before/after numbers. Engine decides, UI words it.

interface SpeakScores {
  fluency: number;
  range: number;
  accuracy: number;
  delivery: number;
}
interface SpeakStored {
  scores?: Partial<SpeakScores>;
  errors?: { trap?: string }[];
}

function parse(s: string): SpeakStored | null {
  try {
    return JSON.parse(s) as SpeakStored;
  } catch {
    return null;
  }
}

function score(s: Partial<SpeakScores> | undefined, k: keyof SpeakScores): number {
  const v = Number(s?.[k]);
  if (!Number.isFinite(v)) return 0;
  return Math.min(10, Math.max(0, Math.round(v * 10) / 10));
}

function overall(s: SpeakScores): number {
  return Math.round(((s.fluency + s.range + s.accuracy + s.delivery) / 4) * 10) / 10;
}

export async function GET() {
  const sessions = await db.speakSession.findMany({ orderBy: { at: "asc" }, take: 200 });
  const rows = sessions
    .map((r) => ({ at: r.at, prompt: String(r.prompt ?? ""), round: Number(r.round ?? 1), res: parse(r.result) }))
    .filter((r) => r.res?.scores && Number.isFinite(r.res.scores!.accuracy));

  // Trend: the last 12 graded sessions, oldest first (chart-ready).
  const trend = rows.slice(-12).map((r) => ({
    at: r.at,
    round: r.round,
    prompt: r.prompt.slice(0, 80),
    fluency: score(r.res!.scores, "fluency"),
    range: score(r.res!.scores, "range"),
    accuracy: score(r.res!.scores, "accuracy"),
    delivery: score(r.res!.scores, "delivery"),
  }));

  // Deltas: same prompt, round 1 -> round 2 (the immediate-retry loop, the
  // exact "immediate opportunity to try again + improvement between attempts"
  // ask). The LATEST pair per prompt wins.
  const byPrompt = new Map<string, { r1?: SpeakScores; r2?: SpeakScores }>();
  for (const r of rows) {
    const key = r.prompt.trim().slice(0, 120);
    if (!key) continue;
    const entry = byPrompt.get(key) ?? {};
    const sc: SpeakScores = {
      fluency: score(r.res!.scores, "fluency"),
      range: score(r.res!.scores, "range"),
      accuracy: score(r.res!.scores, "accuracy"),
      delivery: score(r.res!.scores, "delivery"),
    };
    if (r.round === 2) entry.r2 = sc;
    else if (r.round === 1) entry.r1 = sc;
    byPrompt.set(key, entry);
  }
  const deltas = [...byPrompt.entries()]
    .filter(([, v]) => v.r1 && v.r2)
    .map(([prompt, v]) => ({
      prompt,
      r1: overall(v.r1!),
      r2: overall(v.r2!),
      overallDelta: Math.round((overall(v.r2!) - overall(v.r1!)) * 10) / 10,
      accuracyDelta: Math.round((v.r2!.accuracy - v.r1!.accuracy) * 10) / 10,
      fluencyDelta: Math.round((v.r2!.fluency - v.r1!.fluency) * 10) / 10,
    }))
    .sort((a, b) => b.overallDelta - a.overallDelta);

  // Recurring spoken-error families (the mistake memory, speak slice only).
  const u = await contentUserId();
  const fams = await db.mistakeFamily.findMany({
    where: { userId: u, kind: "speak" },
    orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
    take: 12,
  });
  const traps = fams.map((f) => ({
    tag: f.tag,
    label: f.label,
    count: f.count,
    evidence: f.evidence.slice(0, 200),
    cleanStreak: f.streakClean,
    resolved: Boolean(f.resolvedAt),
  }));

  const accs = rows.map((r) => score(r.res!.scores, "accuracy"));
  const totals = {
    sessions: rows.length,
    avgAccuracy: accs.length ? Math.round((accs.reduce((a, b) => a + b, 0) / accs.length) * 10) / 10 : 0,
    bestAccuracy: accs.length ? Math.max(...accs) : 0,
    retried: deltas.length,
    improved: deltas.filter((d) => d.overallDelta > 0).length,
  };

  return NextResponse.json({ trend, deltas, traps, totals });
}
