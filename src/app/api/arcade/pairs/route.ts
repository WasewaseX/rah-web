// Match-pairs sprint (DUOLINGO-RE.md D3): the board endpoint + the run bonus.
//
// Grading ownership: each successful match is graded BY THE CLIENT through
// /api/review/grade {cardId, grade: 3, dir: "pairs"} - the SAME battle-tested
// FSRS path every other direction uses (schedule, ReviewLog, XP, quests,
// streak all see the retrieval exactly once). This route therefore never
// touches cardState - it only clamps the run's aggregate, pays the sprint's
// own speed bonus (capped), and keeps the pairs stats.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cardById, type Card } from "@/lib/content";
import { dayIndex, cardR, type FsrsState } from "@/lib/fsrs";
import { awardGameXp, bumpStat, progressQuest } from "@/lib/arcade";
import { touchStreak } from "@/lib/server";
import { buildPairs } from "@/lib/pairs";
import { contentUserId } from "@/lib/scope";
import { parseGid, receiptReplay, endReceipt } from "@/lib/sync-receipt";

export const dynamic = "force-dynamic";

async function dueCardsForPairs(): Promise<Card[]> {
  const today = dayIndex();
  const all = await db.cardState.findMany({ where: { userId: await contentUserId().catch(() => "me") } });
  const due = all
    .filter((s) => !s.suspended && s.state !== "new" && s.due <= today)
    .sort((a, b) => cardR(a as unknown as FsrsState, today) - cardR(b as unknown as FsrsState, today))
    .map((s) => cardById(s.cardId))
    .filter((c): c is Card => Boolean(c));
  // new cards top the board up so the sprint is always playable
  const newCards = all
    .filter((s) => s.state === "new" && !s.suspended)
    .sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((s) => cardById(s.cardId))
    .filter((c): c is Card => Boolean(c));
  return [...due, ...newCards];
}

export async function GET() {
  const cards = await dueCardsForPairs();
  const board = buildPairs(cards, dayIndex());
  const best = await db.gameStat.findUnique({ where: { userId_key: { userId: await contentUserId().catch(() => "me"), key: "pairs:clean" } } });
  return NextResponse.json({
    left: board.left,
    right: board.right,
    size: board.size,
    cleanBoards: best?.best ?? 0,
  });
}

interface PairsResult {
  matched: string[]; // card ids the learner paired correctly
  missteps: number; // wrong taps
  ms: number;
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Partial<PairsResult> | null;
  if (!b) return NextResponse.json({ error: "body required" }, { status: 400 });
  const gid = parseGid((b as { gid?: unknown }).gid);
  const uid = await contentUserId().catch(() => "me");
  const replay = await receiptReplay(gid, uid);
  if (replay) return replay;


  // Clamp: at most 5 real cards, deduped, ids must exist in the deck.
  const seen = new Set<string>();
  const matched: string[] = [];
  for (const id of Array.isArray(b.matched) ? b.matched : []) {
    const cid = String(id);
    if (seen.has(cid) || matched.length >= 5) continue;
    if (cardById(cid)) {
      seen.add(cid);
      matched.push(cid);
    }
  }
  const missteps = Math.min(60, Math.max(0, Math.round(Number(b.missteps ?? 0))));
  const ms = Math.min(600_000, Math.max(1_000, Math.round(Number(b.ms ?? 60_000))));

  const graded = matched.length;
  const clean = graded > 0 && missteps === 0;
  const xpAmount = graded * 2 + (clean ? 10 : 0);
  const xp = xpAmount > 0 ? await awardGameXp("pairs", xpAmount, { chainHit: clean }) : null;

  await bumpStat("pairs:plays");
  if (clean) await bumpStat("pairs:clean", graded);
  if (graded > 0) {
    await progressQuest("reviews_20", graded);
    await touchStreak().catch(() => undefined);
  }

  const payload = {
    graded,
    clean,
    xpGain: xp?.paid ?? 0,
    capped: xp?.capped ?? false,
    totalXp: xp?.total ?? 0,
    leveledUp: xp?.leveledUp ?? false,
    level: xp?.level ?? 0,
    unlocked: xp?.unlocked ?? [],
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}
