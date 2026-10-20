// POST /api/settings { newPerDay } - the learner's daily pace, in their hands
// (audit polish #1: configurable daily limits). Clamped to a sane band; the
// queue, badge, and forecast all read this one field (single source of truth).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const n = Math.round(Number(body.newPerDay));
  if (!Number.isFinite(n)) return NextResponse.json({ error: "newPerDay must be a number" }, { status: 400 });
  const clamped = Math.min(30, Math.max(3, n));
  await db.learner.update({ where: { id: "me" }, data: { newPerDay: clamped } });
  const l = await getLearner();
  return NextResponse.json({ ok: true, newPerDay: l.newPerDay, clamped: clamped !== n });
}
