import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Task 78 — offline sync beyond grades: GENERIC gid receipts for the solo
 * arcade modes. The grade route's receipt (GradeAck, Task 68) proved the
 * pattern; the arcade aggregates are server-clamped (anti-cheat) so a replay
 * with the same gid must return the ORIGINAL response and touch nothing -
 * no double XP, no double GameStat bumps, no double quests, no double daily.
 *
 * GradeAck is shape-generic (gid PK, userId, response, at) and is reused as
 * the receipt table for every queued surface; each outbox item generates a
 * fresh uuid gid, so grade receipts and game receipts never collide.
 */

export function parseGid(v: unknown): string {
  return typeof v === "string" && v.length >= 8 && v.length <= 64 ? v : "";
}

/** Returns the stored response when this gid was already served to this user. */
export async function beginReceipt(gid: string, userId: string): Promise<Record<string, unknown> | null> {
  if (!gid) return null;
  try {
    const ack = await db.gradeAck.findUnique({ where: { gid } });
    if (!ack || ack.userId !== userId) return null;
    try {
      return JSON.parse(ack.response) as Record<string, unknown>;
    } catch {
      return null; // torn row: fall through and serve fresh (same rule as the grade route)
    }
  } catch {
    return null; // receipt lookup must never break the game path
  }
}

/** Records the response for this gid. A concurrent duplicate keeps the first receipt. */
export async function endReceipt(gid: string, userId: string, response: Record<string, unknown>): Promise<void> {
  if (!gid) return;
  try {
    await db.gradeAck.create({ data: { gid, userId, response: JSON.stringify(response) } });
  } catch {
    // P2002 (or a receipt hiccup) is fine: the FIRST response is the truth,
    // and this caller already got a consistent clamped payload.
  }
}

/** Convenience for the routes: resolve the user, check the receipt, answer replays. */
export async function receiptReplay(gid: string, userId: string): Promise<NextResponse | null> {
  const stored = await beginReceipt(gid, userId);
  if (!stored) return null;
  return NextResponse.json({ ...stored, replayed: true });
}
