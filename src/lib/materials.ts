// BYO materials (audit Stage 03, feature #1 - the audit's top pick).
// The learner pastes text they actually need to read; this module extracts
// vocabulary + collocations WITH source context and turns them into review
// cards that flow through the SAME FSRS queue as the deck.
//
// Doctrine:
//  - One AI extraction call, then DETERMINISTIC validation: every card's
//    answer must appear in its source sentence, every cloze must carry a
//    real blank, duplicates die, cap 12. A bad extraction cannot ship.
//  - Degraded extraction (the AI was unreachable) is marked on the Material
//    row - never silently equivalent (the P1-7 rule).
//  - No AI, no cards: an extraction that fails validation entirely returns
//    an honest 502, never fabricated content.

import { db } from "@/lib/db";
import { aiJson } from "@/lib/ai";
import { buildProfile } from "@/lib/server";
import { defaultState, dayIndex } from "@/lib/fsrs";
import { contentUserId } from "@/lib/scope";
import type { Card } from "@/lib/content";
import { APKG_MAX_CARDS } from "@/lib/apkg";
import { randomBytes } from "crypto";

function newId(): string {
  return randomBytes(8).toString("hex");
}

export const MAX_MATERIAL_CHARS = 20_000;
const MAX_CARDS = 12;

interface RawItem {
  phrase?: string;
  cloze?: string;
  answer?: string;
  context?: string;
  note?: string;
}

const MAX_TEXT_FOR_AI = 6000;

function extractSystem(): string {
  return `You extract language-learning items from a text the learner must actually read.

Return ONLY the JSON object: { "items": [ { "phrase", "cloze", "answer", "context", "note" } ] }

Rules:
- 6 to 10 items: mostly vocabulary (single words or 2-3 word phrases a B2 learner should know) and at least 2 collocations (natural multi-word combinations FROM the text).
- "context": copy ONE sentence from the text EXACTLY as written, the sentence containing the phrase.
- "cloze": that same sentence with the phrase replaced by exactly ___ (three underscores).
- "answer": the exact phrase as it appears in the sentence.
- "note": one short line (max 14 words): meaning or usage hint in simple English.
- Never invent sentences. Every context must come verbatim from the text.
- Skip proper nouns, numbers, and basic A1 words.`;
}

function deterministicValidate(items: RawItem[], text: string): { front: string; answer: string; context: string; note: string }[] {
  const lower = text.toLowerCase();
  const out: { front: string; answer: string; context: string; note: string }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const answer = String(it.answer ?? it.phrase ?? "").trim();
    const context = String(it.context ?? "").trim().replace(/\s+/g, " ");
    let front = String(it.cloze ?? "").trim().replace(/\s+/g, " ");
    const note = String(it.note ?? "").trim().slice(0, 140);
    if (!answer || answer.length > 40) continue;
    if (!context || context.length < 15) continue;
    // The answer MUST be part of the source sentence (case-insensitive) -
    // this is the "source context" promise.
    if (!context.toLowerCase().includes(answer.toLowerCase())) continue;
    // The context sentence must exist in the material (verbatim-ish).
    if (!lower.includes(context.toLowerCase().slice(0, Math.max(20, context.length - 4)))) continue;
    if (!front || !front.includes("___")) {
      // Rebuild the cloze deterministically from the context.
      const idx = context.toLowerCase().indexOf(answer.toLowerCase());
      if (idx < 0) continue;
      front = context.slice(0, idx) + "___" + context.slice(idx + answer.length);
    }
    if (!front.includes("___")) continue;
    const key = answer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ front, answer, context, note });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

export interface ExtractionResult {
  materialId: string;
  created: number;
  degraded: boolean;
  reason?: string;
}

export async function importMaterial(title: string, text: string, source = ""): Promise<ExtractionResult> {
  const u = await contentUserId().catch(() => "me");
  const trimmed = text.trim().slice(0, MAX_MATERIAL_CHARS);
  if (trimmed.length < 120) throw new Error("The text is too short - paste at least a paragraph (120+ characters).");
  const words = trimmed.split(/\s+/).filter(Boolean).length;

  const p = await buildProfile();
  const excerpt = trimmed.slice(0, MAX_TEXT_FOR_AI);
  let degraded = false;
  let reason: string | undefined;
  let raw: { items?: RawItem[] } = {};
  try {
    raw = await aiJson<{ items?: RawItem[] }>(
      extractSystem(),
      [{ role: "user", content: `Learner level: ${p.level}\n\nTEXT:\n${excerpt}` }],
      () => ({}),
      {
        deep: false,
        temperature: 0.4,
        degraded: (r) => {
          degraded = true;
          reason = r;
        },
      },
    );
  } catch (e) {
    // No AI at all: honest failure - no fabricated cards.
    throw new Error(`Extraction failed: the AI provider was unreachable (${e instanceof Error ? e.message.slice(0, 80) : "unknown"}). Try again in a moment.`);
  }

  const valid = deterministicValidate(raw.items ?? [], trimmed);
  if (valid.length === 0) {
    throw new Error("Extraction found no trustworthy items in this text (every candidate failed source validation). Try a longer or richer passage.");
  }

  const materialId = `m_${newId()}`;
  const today = dayIndex();
  await db.material.create({
    data: {
      id: materialId,
      userId: u,
      title: title.trim().slice(0, 80) || trimmed.slice(0, 60),
      source: source.trim().slice(0, 200),
      text: trimmed,
      words,
      degraded,
    },
  });
  for (const v of valid) {
    const cardId = `mat:${newId()}`;
    await db.materialCard.create({
      data: { id: cardId, materialId, front: v.front, answer: v.answer, context: v.context, note: v.note },
    });
    // Enter the SAME FSRS pipeline: state "new", due today - the queue serves
    // material cards from the shared new-card budget (queue truth stays exact).
    await db.cardState.create({
      data: { userId: u, cardId, ...defaultState(), due: today },
    });
  }
  return { materialId, created: valid.length, degraded, reason };
}

export function materialToCard(m: {
  id: string;
  front: string;
  answer: string;
  context: string;
  note: string;
}): Card {
  return {
    id: m.id,
    unit: "material",
    skill: "vocabulary",
    level: "B2",
    kind: "mat", // directionsFor falls through to ["cloze"] - type-the-blank review
    prompt: m.front,
    answer: m.answer,
    alt: [],
    en: m.context,
    fa: "", // no invented translations: the source sentence IS the context
    note: m.note,
    traps: [],
    distractors: [],
  };
}

export async function materialCardById(cardId: string): Promise<Card | null> {
  if (!cardId.startsWith("mat:")) return null;
  const row = await db.materialCard.findUnique({ where: { id: cardId } });
  return row ? materialToCard(row) : null;
}

// CSV/TSV deck import (feature #4): deterministic parse, MaterialCard rows in
// the same queue. No AI, no context promise (these cards have no source
// sentence) - the note says where they came from.
export async function importDeckCsv(title: string, csv: string): Promise<ExtractionResult> {
  const { parseDeckCsv } = await import("@/lib/csv-cards");
  const u = await contentUserId().catch(() => "me");
  const parsed = parseDeckCsv(csv.slice(0, MAX_MATERIAL_CHARS));
  if (parsed.cards.length === 0) {
    throw new Error("No usable rows found. Expected lines like: front<TAB>back (Anki-style). # header lines and empty rows are skipped.");
  }
  const materialId = `m_${newId()}`;
  const today = dayIndex();
  await db.material.create({
    data: {
      id: materialId,
      userId: u,
      title: title.trim().slice(0, 80) || "Imported deck",
      source: "Imported deck (CSV/TSV)",
      text: csv.slice(0, MAX_MATERIAL_CHARS),
      words: parsed.cards.length,
    },
  });
  for (const c of parsed.cards) {
    const cardId = `mat:${newId()}`;
    await db.materialCard.create({
      data: { id: cardId, materialId, front: c.front, answer: c.answer, context: "", note: c.note },
    });
    await db.cardState.create({ data: { userId: u, cardId, ...defaultState(), due: today } });
  }
  return { materialId, created: parsed.cards.length, degraded: false, reason: parsed.skipped ? `${parsed.skipped} row(s) skipped (empty, duplicate, or over the ${300}-row cap)` : undefined };
}

// Anki .apkg import (feature #4 v2): real Anki package exports become live
// FSRS cards - same machinery as CSV, no AI, honest about what stays behind
// (media refs and Anki's own scheduling state do not cross over).
export async function importDeckApkg(title: string, buf: Uint8Array): Promise<ExtractionResult & { mediaRefs?: number }> {
  const { parseApkg } = await import("@/lib/apkg");
  const u = await contentUserId().catch(() => "me");
  const parsed = await parseApkg(buf);
  if (parsed.cards.length === 0) {
    throw new Error(`No usable cards found in the .apkg (${parsed.skipped} skipped: empty fronts/backs, duplicates, or the ${300}-card cap).`);
  }
  const materialId = `m_${newId()}`;
  const today = dayIndex();
  await db.material.create({
    data: {
      id: materialId,
      userId: u,
      title: title.trim().slice(0, 80) || "Imported Anki deck",
      source: `Imported deck (Anki .apkg, ${parsed.format})`,
      text: `(binary .apkg import - ${parsed.cards.length} cards from the collection)`,
      words: parsed.cards.length,
    },
  });
  for (const c of parsed.cards) {
    const cardId = `mat:${newId()}`;
    await db.materialCard.create({
      data: { id: cardId, materialId, front: c.front, answer: c.back, context: "", note: "" },
    });
    await db.cardState.create({ data: { userId: u, cardId, ...defaultState(), due: today } });
  }
  const bits = [parsed.skipped ? `${parsed.skipped} note(s) skipped (empty, duplicate, or over the ${APKG_MAX_CARDS}-card cap)` : ""];
  if (parsed.mediaRefs > 0) bits.push(`${parsed.mediaRefs} media ref(s) left behind (audio/images do not import yet)`);
  return {
    materialId,
    created: parsed.cards.length,
    degraded: false,
    reason: bits.filter(Boolean).join(", ") || undefined,
    mediaRefs: parsed.mediaRefs,
  };
}
