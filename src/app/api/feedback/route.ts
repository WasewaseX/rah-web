import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserWithRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Review feature #17 (the 7.4/10 wave): "Human feedback and content
// correction". A learner can flag a question, explanation or Farsi note they
// believe is wrong. The flag is a QUEUE, not a black hole: read_state shows
// the open count to the coach, and the clamps below keep a hostile client
// from flooding it. Every input is clamped; exact duplicates of an open flag
// are refused honestly (duplicate: true) instead of piling up.

const KINDS = new Set(["wrong_answer", "bad_explanation", "bad_farsi", "typo", "other"]);
const OPEN_CAP = 500;

function clamp(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .trim()
    .slice(0, max);
}

export async function GET(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const [open, recent] = await Promise.all([
    db.contentFlag.count({ where: { status: "open" } }),
    db.contentFlag.findMany({ orderBy: { id: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({
    open,
    recent: recent.map((f) => ({ id: f.id, cardId: f.cardId, kind: f.kind, note: f.note, status: f.status, at: f.at })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const cardId = clamp((body as { cardId?: unknown }).cardId, 64);
  const kindRaw = String((body as { kind?: unknown }).kind ?? "other");
  const kind = KINDS.has(kindRaw) ? kindRaw : "other";
  const note = clamp((body as { note?: unknown }).note, 300);

  const openCount = await db.contentFlag.count({ where: { status: "open" } });
  if (openCount >= OPEN_CAP) {
    return NextResponse.json({ error: "The flag queue is full - the coach will triage it first." }, { status: 429 });
  }

  if (cardId) {
    const dup = await db.contentFlag.findFirst({
      where: { cardId, kind, note, status: "open" },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ duplicate: true, id: dup.id });
  }

  const flag = await db.contentFlag.create({ data: { cardId, kind, note } });
  return NextResponse.json({ ok: true, id: flag.id, kind });
}
