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
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const u = await contentUserId(req).catch(() => "me");
  if (id) {
    // Owner-scoped: another account's material reads as 404, never as content.
    const m = await db.material.findFirst({ where: { id, userId: u }, include: { cards: true } });
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
    where: { userId: u },
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
  const mode = String(body.mode ?? "text");
  // CSV/TSV deck import: deterministic, no model call, no context promise.
  if (mode === "csv") {
    if (text.trim().length < 3) {
      return NextResponse.json({ error: "Paste at least one row: front<TAB>back." }, { status: 400 });
    }
    try {
      const { importDeckCsv } = await import("@/lib/materials");
      const out = await importDeckCsv(title, text);
      return NextResponse.json({ ok: true, ...out });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed." }, { status: 400 });
    }
  }
  // Anki .apkg import (feature #4 v2): the client base64s the package; the
  // server unzips it (ZIP + SQLite via bun:sqlite) - deterministic, no model
  // call, no context promise. Every refusal is a client-side problem: 400.
  if (mode === "apkg") {
    const dataB64 = String(body.dataB64 ?? "");
    if (!dataB64) {
      return NextResponse.json({ error: "Pick an .apkg file first." }, { status: 400 });
    }
    let buf: Uint8Array;
    try {
      buf = Uint8Array.from(Buffer.from(dataB64, "base64"));
    } catch {
      return NextResponse.json({ error: "The file data could not be decoded." }, { status: 400 });
    }
    try {
      const { importDeckApkg } = await import("@/lib/materials");
      const out = await importDeckApkg(title, buf);
      return NextResponse.json({ ok: true, ...out });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed." }, { status: 400 });
    }
  }
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
  const u = await contentUserId(req).catch(() => "me");
  const m = await db.material.findFirst({ where: { id, userId: u }, include: { cards: true } });
  if (!m) return NextResponse.json({ error: "Material not found." }, { status: 404 });
  // The schedule state of every card dies with the material - no orphans.
  await db.cardState.deleteMany({ where: { userId: u, cardId: { in: m.cards.map((c) => c.id) } } });
  await db.material.delete({ where: { id } });
  return NextResponse.json({ ok: true, removed: m.cards.length });
}
