import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { getLearner } from "@/lib/server";
import { awardGameXp, bumpStat, progressQuest, registerMiss, hasPerk } from "@/lib/arcade";
import { buildSpeedPool, duelPar } from "@/lib/arcade-items";
import { contentUserId } from "@/lib/scope";
import { parseGid, receiptReplay, endReceipt } from "@/lib/sync-receipt";

export const dynamic = "force-dynamic";

const ITEMS = 8;

// GET: 8 items (keys ship for instant local grading, like the Speed Round)
// plus the rival's deterministic par for this run seed. The rival faces the
// exact same items; their accuracy mirrors your trailing two weeks.
export async function GET() {
  const [items, l] = await Promise.all([buildSpeedPool(ITEMS), getLearner()]);
  const seed = Math.floor(Date.now() / 1000) % 2_000_000_000;
  const u = await contentUserId().catch(() => "me");
  const recent = await db.dailyStat.findMany({ where: { userId: u, day: { gte: dayIndex() - 14 } } });
  const tot = recent.reduce((s, r) => s + r.reviews, 0);
  const cor = recent.reduce((s, r) => s + r.correct, 0);
  const accuracy = tot >= 20 ? cor / tot : 0.6;
  const parHits = duelPar(seed, ITEMS, accuracy);
  const timer = 40 + (hasPerk(l.perks, "duel_time") ? 10 : 0);
  return NextResponse.json({
    items,
    seed,
    parHits,
    rivalScore: parHits * 10 + 20, // + flat time bonus: the rival is quick
    timer,
    wins: (await db.gameStat.findUnique({ where: { userId_key: { userId: await contentUserId().catch(() => "me"), key: "duel:wins" } } }))?.best ?? 0,
    streak: (await db.gameStat.findUnique({ where: { userId_key: { userId: await contentUserId().catch(() => "me"), key: "duel:streak" } } }))?.best ?? 0,
  });
}

export async function POST(req: Request) {
  const b = (await req.json()) as { seed?: number; correct?: number; total?: number; maxCombo?: number; ms?: number };
  const total = Math.min(ITEMS, Math.max(0, Math.round(Number(b.total ?? 0))));
  const correct = Math.min(total, Math.max(0, Math.round(Number(b.correct ?? 0))));
  const seed = Math.max(0, Math.min(2_000_000_000, Math.round(Number(b.seed ?? 0))));
  const ms = Math.min(300_000, Math.max(5_000, Math.round(Number(b.ms ?? 40_000))));
  const gid = parseGid((b as { gid?: unknown }).gid);
  const uid = await contentUserId().catch(() => "me");
  const replay = await receiptReplay(gid, uid);
  if (replay) return replay;

  // Anti-cheat: 10 points per hit plus at most a 20-point speed bonus.
  const youScore = Math.min(correct * 10 + 20, correct * 10 + Math.max(0, 20 - Math.floor(ms / 4000)));
  const l = await getLearner();
  const recent = await db.dailyStat.findMany({ where: { userId: await contentUserId().catch(() => "me"), day: { gte: dayIndex() - 14 } } });
  const tot = recent.reduce((s, r) => s + r.reviews, 0);
  const cor = recent.reduce((s, r) => s + r.correct, 0);
  const accuracy = tot >= 20 ? cor / tot : 0.6;
  const parHits = duelPar(seed, ITEMS, accuracy);
  const rivalScore = parHits * 10 + 20;
  const win = youScore > rivalScore;

  if (win) {
    const uW = await contentUserId().catch(() => "me");
    const w = (await db.gameStat.findUnique({ where: { userId_key: { userId: uW, key: "duel:wins" } } }))?.best ?? 0;
    const s = (await db.gameStat.findUnique({ where: { userId_key: { userId: uW, key: "duel:streak" } } }))?.best ?? 0;
    await bumpStat("duel:wins", w + 1);
    await bumpStat("duel:streak", s + 1);
    await progressQuest("duel_1", 1);
  } else {
    await bumpStat("duel:streak", 0);
    await registerMiss();
  }
  await bumpStat("duel:plays");
  const xp = await awardGameXp("duel", win ? 60 : 25, { chainHit: win });
  const payload = {
    win,
    youScore,
    rivalScore,
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    unlocked: xp.unlocked,
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}
