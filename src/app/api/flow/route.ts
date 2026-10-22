import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { awardGameXp, bumpStat, progressQuest } from "@/lib/arcade";
import { buildSpeedPool } from "@/lib/arcade-items";

import { aiRateLimit } from "@/lib/rate-limit";
import { contentUserId } from "@/lib/scope";
import { parseGid, receiptReplay, endReceipt } from "@/lib/sync-receipt";

export const dynamic = "force-dynamic";

const ITEMS = 12;

// GET: the Focus Flow drill queue - weak-tag-biased mixed pool, keys ship
// for local grading, the server clamps the submitted aggregate.
export async function GET() {
  const u = await contentUserId().catch(() => "me");
  const items = await buildSpeedPool(ITEMS);
  const streak = (await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "flow:streak" } } }))?.best ?? 0;
  const best = (await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "flow:best" } } }))?.best ?? 0;
  const due = await db.cardState.count({ where: { userId: u, state: { not: "new" }, due: { lte: dayIndex() }, suspended: false } });
  return NextResponse.json({ items, streak, best, due });
}

export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const b = (await req.json()) as { correct?: number; total?: number; ms?: number };
  const total = Math.min(ITEMS, Math.max(0, Math.round(Number(b.total ?? 0))));
  const correct = Math.min(total, Math.max(0, Math.round(Number(b.correct ?? 0))));
  const ms = Math.min(3_600_000, Math.max(30_000, Math.round(Number(b.ms ?? 900_000))));
  const gid = parseGid((b as { gid?: unknown }).gid);
  const uid = await contentUserId().catch(() => "me");
  const replay = await receiptReplay(gid, uid);
  if (replay) return replay;

  const gain = correct * 10 + (total >= 8 && correct / Math.max(1, total) >= 0.8 ? 30 : 0);
  const xp = gain > 0 ? await awardGameXp("flow", gain, { chainHit: correct / Math.max(1, total) >= 0.8 }) : null;

  // Flow streak: consecutive days with at least one completed flow.
  const today = dayIndex();
  const uF = await contentUserId().catch(() => "me");
  const last = await db.gameStat.findUnique({ where: { userId_key: { userId: uF, key: "flow:last" } } });
  const cur = await db.gameStat.findUnique({ where: { userId_key: { userId: uF, key: "flow:streak" } } });
  const streak = last?.best === today ? (cur?.best ?? 1) : last?.best === today - 1 ? (cur?.best ?? 0) + 1 : 1;
  await db.gameStat.upsert({ where: { userId_key: { userId: uF, key: "flow:last" } }, create: { userId: uF, key: "flow:last", best: today }, update: { best: today } });
  await bumpStat("flow:streak", streak);
  await bumpStat("flow:best", correct);
  await bumpStat("flow:plays");
  await progressQuest("flow_1", 1);
  const payload = {
    xpGain: xp?.paid ?? 0,
    capped: xp?.capped ?? false,
    totalXp: xp?.total,
    leveledUp: xp?.leveledUp ?? false,
    unlocked: xp?.unlocked ?? [],
    streak,
    perfectBonus: total >= 8 && correct / Math.max(1, total) >= 0.8,
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}
