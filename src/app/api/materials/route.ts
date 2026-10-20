// /api/materials - bring-your-own-materials learning (Stage 03 #1).
//
// GET            list materials with card counts (+ ?id= for one material's
//                full text and cards - the "inspect the source" surface).
// POST {title, text, source?}  extract items (AI + deterministic validation)
//                and create FSRS-tracked cards in the shared review queue.
// DELETE ?id=    remove a material, its cards, and their schedule state.
//
// POST is rate-limited (aiRateLimit) - extraction burns a model call.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { importMaterial } from "@/lib/materials";
import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const m = await db.material.findUnique({ where: { id }, include: { cards: true } });
    if (!m) return NextResponse.json({ error: "Material not found." }, { status: 404 });
    return NextResponse.json({
      id: m.id,
      title: m.title,
      source: m.source,
      text: m.text,
      words: m.words,
      degraded: m.degraded,
      createdAt: m.createdAt,
      cards: m.cards.map((c) => ({ id: c.id, front: c.front, answer: c.answer, context: c.context, note: c.note })),
    });
  }
  const mats = await db.material.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cards: true } } },
  });
  return NextResponse.json({
    materials: mats.map((m) => ({
      id: m.id,
      title: m.title,
      source: m.source,
      words: m.words,
      degraded: m.degraded,
      cards: m._count.cards,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "");
  const text = String(body.text ?? "");
  const source = String(body.source ?? "");
  // Honest client-side refusal BEFORE any model call (400: the request itself
  // is wrong). Provider failures later return 502.
  if (text.trim().length < 120) {
    return NextResponse.json({ error: "The text is too short - paste at least a paragraph (120+ characters)." }, { status: 400 });
  }
  try {
    const out = await importMaterial(title, text, source);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const m = await db.material.findUnique({ where: { id }, include: { cards: true } });
  if (!m) return NextResponse.json({ error: "Material not found." }, { status: 404 });
  // The schedule state of every card dies with the material - no orphans.
  await db.cardState.deleteMany({ where: { cardId: { in: m.cards.map((c) => c.id) } } });
  await db.material.delete({ where: { id } });
  return NextResponse.json({ ok: true, removed: m.cards.length });
}
