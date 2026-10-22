// The mastery ledger - fine-grained half of the learner model.
//
// MistakeFamily answers "what does the learner keep getting wrong";
// TagMastery answers "how good are they at each trap tag, how sure are we,
// and which way is it moving". Together they are the central learner model
// we own: every graded surface feeds it, every coach surface reads it.
//
// Two statistics per tag, deliberately separate:
// - EWMA (stored): recency-weighted outcome estimate, alpha 0.35. Answers
//   "how is the learner doing lately" - a tag solved a month ago but missed
//   today reads low again.
// - Wilson lower bound (computed, never stored): a conservative success
//   rate with uncertainty folded in. 2/2 correct is NOT 100% mastery - the
//   bound says ~34%. This is what keeps three lucky answers from
//   retiring a weakness.

import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";

const ALPHA = 0.35;
const Z = 1.96; // 95% Wilson interval

export type MasteryStatus = "danger" | "fragile" | "rising" | "solid" | "unproven";

export interface TagMasteryRow {
  tag: string;
  samples: number;
  ok: number;
  no: number;
  raw: number; // ok / samples
  ewma: number; // recency-weighted, 0..1
  wilson: number; // lower bound, 0..1 - the honest mastery score
  trend: "rising" | "falling" | "flat";
  status: MasteryStatus;
}

export interface MasteryView {
  tags: TagMasteryRow[];
  danger: string[]; // statistically weak: hunt in exams
  fragile: string[]; // falling lately: review
  solid: string[]; // proven strong: stop drilling these
  summary: string; // one human line
}

// Normalization mirror of mistakes.normalizeTag - a tag learned from any
// surface must land on the SAME key in both the ledger and the family
// memory. The family memory canon is lowercase underscores (hyphens and
// spaces collapse to _), so the ledger uses exactly that key space. Local
// copy avoids a circular import (mistakes.ts calls noteTagOutcome).
export function normalizeTag(tag: string): string {
  const t = String(tag ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return t === "none" || t === "unknown" ? "" : t;
}

// The isolation seam (Task 65): explicit userId wins; otherwise the session
// user; else the singleton while the deployment lock holds. The ledger is
// per-learner learning signal - two accounts never share a row.
async function actor(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    return await contentUserId();
  } catch {
    return "me";
  }
}

export async function noteTagOutcome(tag: string, ok: boolean, userId?: string): Promise<void> {
  const u = await actor(userId);
  const t = normalizeTag(tag);
  if (!t) return;
  try {
    const existing = await db.tagMastery.findUnique({ where: { userId_tag: { userId: u, tag: t } } });
    const prevEwma = existing?.ewma ?? 0.5;
    const ewma = prevEwma * (1 - ALPHA) + (ok ? 1 : 0) * ALPHA;
    await db.tagMastery.upsert({
      where: { userId_tag: { userId: u, tag: t } },
      create: {
        userId: u,
        tag: t,
        ok: ok ? 1 : 0,
        no: ok ? 0 : 1,
        ewma,
        lastOk: ok ? new Date() : null,
        lastNo: ok ? null : new Date(),
      },
      update: {
        ok: { increment: ok ? 1 : 0 },
        no: { increment: ok ? 0 : 1 },
        ewma,
        lastOk: ok ? new Date() : undefined,
        lastNo: ok ? undefined : new Date(),
      },
    });
  } catch {
    // The ledger must never break the surface that feeds it.
  }
}

function wilsonLower(ok: number, n: number): number {
  if (n === 0) return 0;
  const p = ok / n;
  const denom = 1 + (Z * Z) / n;
  const centre = p + (Z * Z) / (2 * n);
  const spread = Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n));
  return Math.max(0, Math.min(1, (centre - spread) / denom));
}

export function classifyTag(tag: string, ok: number, no: number, ewma: number): TagMasteryRow {
  const samples = ok + no;
  const raw = samples ? ok / samples : 0;
  const wilson = wilsonLower(ok, samples);
  // Trend: recent form (ewma) against the long-run record (raw). A tag whose
  // recent form clearly beats its average is recovering; clearly below is
  // slipping. The 0.12 gap keeps one-answer noise out of the arrow.
  const trend: TagMasteryRow["trend"] = samples < 2 ? "flat" : ewma - raw > 0.12 ? "rising" : raw - ewma > 0.12 ? "falling" : "flat";
  let status: MasteryStatus;
  if (samples < 3) status = "unproven";
  else if (wilson < 0.45) status = "danger";
  else if (trend === "falling" && ewma < 0.55) status = "fragile";
  else if (trend === "rising" || wilson >= 0.7) status = "rising";
  else status = "solid";
  return { tag, samples, ok, no, raw: Math.round(raw * 100) / 100, ewma: Math.round(ewma * 100) / 100, wilson: Math.round(wilson * 100) / 100, trend, status };
}

export async function getMasteryView(userId?: string): Promise<MasteryView> {
  const u = await actor(userId);
  const rows = await db.tagMastery.findMany({ where: { userId: u } });
  const tags = rows
    .map((r) => classifyTag(r.tag, r.ok, r.no, r.ewma))
    .sort((a, b) => a.wilson - b.wilson || b.samples - a.samples);
  const danger = tags.filter((t) => t.status === "danger").map((t) => t.tag);
  const fragile = tags.filter((t) => t.status === "fragile").map((t) => t.tag);
  const solid = tags.filter((t) => t.status === "rising" || t.status === "solid").map((t) => t.tag);
  let summary = "No tag evidence yet - answer tagged exam items and the ledger fills itself.";
  if (tags.length) {
    const weakest = tags[0];
    const strongest = tags[tags.length - 1];
    const parts = [`${weakest.tag} is the leak (${Math.round(weakest.wilson * 100)}% proven)`];
    if (strongest.tag !== weakest.tag) parts.push(`${strongest.tag} is holding (${Math.round(strongest.wilson * 100)}%)`);
    if (fragile.length) parts.push(`${fragile.join(", ")} slipping lately`);
    summary = parts.join("; ") + ".";
  }
  return { tags, danger, fragile, solid, summary };
}

// Weakness quota upgrade for the exam generator: MistakeFamilies (failure
// counts) plus statistically proven danger tags the families do not know
// about yet. The generator keeps its cap of 3 by taking families first -
// they carry production evidence - then danger tags.
export async function masteryWeakTags(): Promise<string[]> {
  const view = await getMasteryView();
  return [...view.danger, ...view.fragile].slice(0, 3);
}
