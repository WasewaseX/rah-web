import { NextResponse } from "next/server";
import { buildSpeedPool, type ArcadeItem } from "@/lib/arcade-items";
import { awardGameXp, bumpStat, progressQuest, registerMiss } from "@/lib/arcade";
import { bumpDaily, touchStreak } from "@/lib/server";
import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";
import { parseGid, receiptReplay, endReceipt } from "@/lib/sync-receipt";

export const dynamic = "force-dynamic";

// GET: a fresh 40-item blitz pool. Keys ship to the client on purpose - the
// game grades locally for instant feedback at speed; the server sanity-checks
// the submitted aggregate.
export async function GET() {
  const items = await buildSpeedPool(40);
  const u = await contentUserId().catch(() => "me");
  const best = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "speed:best" } } });
  const combo = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "speed:combo" } } });
  return NextResponse.json({
    items: items.map((i: ArcadeItem) => ({ ...i })),
    best: best?.best ?? 0,
    bestCombo: combo?.best ?? 0,
  });
}

interface SpeedResult {
  score: number;
  correct: number;
  total: number;
  maxCombo: number;
  ms: number;
}

// POST: the run's aggregate. Every number is clamped against what is
// physically possible in the mode (40 items, combo bonus capped at 5x),
// so a tampered client still cannot mint XP.
export async function POST(req: Request) {
  const b = (await req.json()) as Partial<SpeedResult>;
  const total = Math.min(40, Math.max(0, Math.round(Number(b.total ?? 0))));
  const correct = Math.min(total, Math.max(0, Math.round(Number(b.correct ?? 0))));
  const maxCombo = Math.min(correct, Math.max(0, Math.round(Number(b.maxCombo ?? 0))));
  const ms = Math.min(300_000, Math.max(1_000, Math.round(Number(b.ms ?? 60_000))));
  // Anti-cheat: the best score a run with `correct` hits and a max combo of
  // `maxCombo` can physically produce is one streak of maxCombo (capped at
  // 5x per item) plus every other hit isolated at 5x. Anything above that is
  // impossible, so it is clamped before it can touch the leaderboard.
  const tri = (n: number) => (n * (n + 1)) / 2;
  const m = Math.min(5, maxCombo);
  const cap = 10 * tri(m) + 50 * Math.max(0, correct - maxCombo);
  const score = Math.min(Math.max(0, Math.round(Number(b.score ?? 0))), cap);
  const gid = parseGid((b as { gid?: unknown }).gid);
  const uid = await contentUserId().catch(() => "me");
  const replay = await receiptReplay(gid, uid);
  if (replay) return replay;


  const bestRun = await bumpStat("speed:best", score);
  const bestCombo = await bumpStat("speed:combo", maxCombo);
  await bumpStat("speed:plays");
  await bumpDaily("reviews", total);
  await bumpDaily("correct", correct);
  const xp = await awardGameXp("speed", Math.min(80, Math.round(score / 12)), { chainHit: correct > 0 });
  if (correct < total) await registerMiss();
  await touchStreak();
  await progressQuest("speed_play", 1);
  if (maxCombo > 0) await progressQuest("speed_combo_8", maxCombo);

  const payload = {
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
    best: bestRun.best,
    isNewBest: bestRun.isNew,
    bestCombo: bestCombo.best,
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}
