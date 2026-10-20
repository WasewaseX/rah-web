// POST /api/review/suspend { cardId, suspended } - the learner's escape hatch
// from a card that keeps hurting (audit polish #1: suspended/difficult cards).
// Suspended cards leave every queue path (due, new, ahead) and every count;
// unsuspend returns them exactly where FSRS had them - no schedule reset.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cardId = String(body.cardId ?? "");
  const suspended = body.suspended !== false; // default true; only explicit false unsuspends
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const row = await db.cardState.findUnique({ where: { cardId } });
  if (!row) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  await db.cardState.update({ where: { cardId }, data: { suspended } });
  return NextResponse.json({ ok: true, cardId, suspended });
}
