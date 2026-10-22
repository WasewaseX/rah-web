// Mistake memory. Every production correction (chat, essay, speaking) carries
// a trap tag from the Farsi-interference taxonomy; this module folds those
// tags into persistent families so a recurring weakness is visible to the
// tutor, the examiner and the progress page - and so practice hunts the leak
// instead of rediscovering it every session.
//
// Task 65 - isolation completion + learner-memory corrections:
//   - Every family is stamped and filtered by userId (the memory quotes the
//     learner's own sentences - it is learner content, audit P0 doctrine).
//     Family ids are userId-prefixed: "me:chat:statives". Every exported
//     function resolves the caller's user when none is passed (cookie-based,
//     request-context), so the 20+ existing call sites keep their shape.
//   - FORGET is no longer a bare delete: the family leaves the memory AND a
//     tombstone (MistakeForgiven) records the exact rejected evidence pair.
//     The same wrong->right pair will not re-aggregate (a false positive the
//     learner rejected must not resurrect every session), but genuinely NEW
//     evidence under the same tag reopens the family - forgetting one example
//     is not blinding the coach to future ones.
//   - CORRECT lets the learner fix what the memory quotes (label/evidence);
//     editedAt marks the row learner-authored so no surface presents
//     learner-edited text as AI-mined.

import { createHash } from "crypto";
import { db } from "@/lib/db";
import { noteTagOutcome } from "@/lib/mastery";
import { contentUserId } from "@/lib/scope";

export interface MistakeInput {
  kind: "chat" | "writing" | "speak" | "exam" | "placement" | "listen";
  tag: string; // raw trap tag from the model, e.g. "statives", "none"
  wrong: string;
  right: string;
}

// How many consecutive correct answers on weakness-targeted exam items retire
// a family. Two clean hits under exam pressure is real evidence of healing.
const CLEAN_HITS_TO_RESOLVE = 2;

const TAG_LABELS: Record<string, string> = {
  statives: "Stative verbs used in continuous forms",
  articles: "Article misuse (a/an/the)",
  countability: "Countability (advice, information, furniture)",
  plurals: "Plural formation",
  copula: "Missing or wrong copula",
  prepositions: "Prepositions (dar covers in/at/on)",
  perfect: "Present perfect vs past simple",
  question_order: "Question word order",
  adjectives: "Adjective order or agreement",
  that_omission: "Omitted that in reported clauses",
  spelling: "Spelling",
  word_choice: "Word choice",
  register: "Register (formal vs casual)",
  conditional: "Conditionals (would have + participle)",
  fluency_illusion: "Trusting fluency: mistaking ease for learning",
};

function normalizeTag(raw: string): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

/** Human-readable label for a trap tag, shared by placement feedback and the
 *  mistake UI. Falls back to a prettified tag for codes not in the map. */
export function tagLabel(raw: string): string {
  const tag = normalizeTag(raw);
  if (!tag || tag === "none") return "";
  return labelFor(tag, "recent answers");
}

function labelFor(tag: string, kind: string): string {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  // Sound Lab contrasts (Task 43): sound_w_v, sound_th, sound_vowel_i_ee, ...
  // render as "Sound: w vs v" instead of the generic recurring-family line.
  if (tag.startsWith("sound_")) {
    const raw = tag.slice("sound_".length).replace(/_/g, " ").trim();
    if (raw === "th") return "Sound: th (tink vs think)";
    if (raw === "ng") return "Sound: final -ng drops to -n";
    if (raw === "clusters") return "Sound: final clusters reduce";
    if (raw.startsWith("vowel ")) return `Sound: vowels (${raw.slice(6)}) collapse`;
    const tokens = raw.split(/\s+/);
    if (tokens.length === 2) return `Sound: ${tokens[0]} vs ${tokens[1]}`;
    return `Sound: ${raw} contrast`;
  }
  const pretty = tag.replace(/_/g, " ");
  return `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} recurring in ${kind}`;
}

function familyId(userId: string, kind: string, tag: string): string {
  return `${userId}:${kind}:${tag}`;
}

function evidenceHash(wrong: string, right: string): string {
  return createHash("sha1").update(`${wrong.trim().toLowerCase()} -> ${right.trim().toLowerCase()}`).digest("hex");
}

// The isolation seam: explicit userId wins; otherwise resolve the session
// user (cookie-based, works inside any route-handler context). Falls back to
// the singleton - recovery beats rigidness while the deployment lock holds.
async function actor(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    return await contentUserId();
  } catch {
    return "me";
  }
}

// Record production mistakes. Only tagged corrections aggregate; "none" or
// empty tags are skipped so unclassifiable noise never invents fake families.
// A tombstoned (forgiven) identical evidence pair is skipped too - the learner
// rejected that exact correction, and mining must not resurrect it.
export async function recordMistakes(items: MistakeInput[], userId?: string): Promise<void> {
  const u = await actor(userId);
  const grouped = new Map<string, MistakeInput & { tag: string }>();
  for (const item of items) {
    const tag = normalizeTag(item.tag);
    if (!tag || tag === "none" || !item.wrong?.trim() || !item.right?.trim()) continue;
    const key = `${item.kind}:${tag}`;
    const existing = grouped.get(key);
    if (!existing) grouped.set(key, { ...item, tag });
  }
  for (const [, m] of grouped) {
    const wrong = m.wrong.trim().slice(0, 140);
    const right = m.right.trim().slice(0, 140);
    const evidence = `${wrong} -> ${right}`;
    try {
      const id = familyId(u, m.kind, m.tag);
      const tomb = await db.mistakeForgiven.findUnique({ where: { id } });
      if (tomb && tomb.evidenceHash === evidenceHash(wrong, right)) continue;
      await db.mistakeFamily.upsert({
        where: { id },
        create: {
          id,
          userId: u,
          kind: m.kind,
          tag: m.tag,
          label: labelFor(m.tag, m.kind),
          count: 1,
          evidence,
        },
        update: {
          count: { increment: 1 },
          evidence,
          lastSeen: new Date(),
          // Relapse: a family the learner produced again is live again,
          // resolved or not. The healing streak resets with it.
          resolvedAt: null,
          streakClean: 0,
        },
      });
    } catch {
      // Memory must never break the turn that produced the mistake.
    }
  }
}

export interface MistakeFamilyView {
  id: string;
  kind: string;
  tag: string;
  label: string;
  count: number;
  evidence: string;
  lastSeen: string;
  streakClean: number;
  resolvedAt: string | null;
  editedAt: string | null;
}

function toView(r: {
  id: string; kind: string; tag: string; label: string; count: number;
  evidence: string; lastSeen: Date; streakClean: number; resolvedAt: Date | null; editedAt: Date | null;
}): MistakeFamilyView {
  return {
    id: r.id,
    kind: r.kind,
    tag: r.tag,
    label: r.label,
    count: r.count,
    evidence: r.evidence,
    lastSeen: r.lastSeen.toISOString(),
    streakClean: r.streakClean,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
  };
}

// activeOnly=true feeds prompts and exams: a resolved family stays in the
// history view but must stop steering what the tutor hunts and what the
// examiner builds - that is the whole point of healing.
export async function topMistakes(limit = 6, activeOnly = false, userId?: string): Promise<MistakeFamilyView[]> {
  const u = await actor(userId);
  const rows = await db.mistakeFamily.findMany({
    where: activeOnly ? { userId: u, resolvedAt: null } : { userId: u },
    orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
    take: limit,
  });
  return rows.map(toView);
}

// The healing loop's exam side. Weakness-targeted exam items carry their
// family tag; grading reports each answer here. A correct answer extends the
// clean streak toward retirement; a miss is fresh relapse evidence that
// reopens every family under that tag and records an exam-side family.
export async function noteExamAnswer(tag: string, wrong: string, right: string, correct: boolean, userId?: string): Promise<void> {
  const u = await actor(userId);
  const t = normalizeTag(tag);
  if (!t) return;
  try {
    if (correct) {
      await db.mistakeFamily.updateMany({
        where: { userId: u, tag: t },
        data: { streakClean: { increment: 1 } },
      });
      const due = await db.mistakeFamily.findMany({ where: { userId: u, tag: t, resolvedAt: null, streakClean: { gte: CLEAN_HITS_TO_RESOLVE } } });
      for (const f of due) {
        await db.mistakeFamily.update({ where: { id: f.id }, data: { resolvedAt: new Date() } });
      }
    } else {
      // An exam miss is production evidence too: it counts, it shows, and it
      // reopens every healed family sharing the tag.
      await recordMistakes([{ kind: "exam", tag: t, wrong: wrong.slice(0, 140) || "(blank)", right: right.slice(0, 140) }], u);
      await db.mistakeFamily.updateMany({
        where: { userId: u, tag: t, id: { not: familyId(u, "exam", t) } },
        data: { streakClean: 0, resolvedAt: null },
      });
    }
  } catch {
    // Memory must never break the grading turn that fed it.
  }
}

export interface PlacementMiss {
  tag: string;
  wrong: string;
  right: string;
}

export interface TrapSummary {
  tag: string;
  label: string;
  count: number;
}

// The diagnostic side of the healing loop. Placement misses are the single
// richest signal the app ever gets: a measured, deliberate miss on a tagged
// trap. Fold them into families so the very first exam after placement already
// hunts them - and reopen any healed family the diagnostic proved is still
// leaking. Returns the top traps for the result screen.
export async function foldPlacementMisses(misses: PlacementMiss[], userId?: string): Promise<TrapSummary[]> {
  const u = await actor(userId);
  const valid = misses
    .map((m) => ({ ...m, tag: normalizeTag(m.tag) }))
    .filter((m) => m.tag && m.tag !== "none" && m.wrong.trim() && m.right.trim());
  if (valid.length === 0) return [];

  const counts = new Map<string, number>();
  const evidence = new Map<string, PlacementMiss>();
  for (const m of valid) {
    counts.set(m.tag, (counts.get(m.tag) ?? 0) + 1);
    if (!evidence.has(m.tag)) evidence.set(m.tag, m);
  }

  await recordMistakes(
    [...evidence.values()].map((m) => ({
      kind: "placement" as const,
      tag: m.tag,
      wrong: m.wrong,
      right: m.right,
    })),
    u,
  );

  // A placement miss is relapse evidence for every family sharing the tag,
  // whatever kind originally owned it - same rule an exam miss follows. It
  // also debits the mastery ledger: placement is the highest-stakes "no"
  // evidence there is.
  for (const tag of counts.keys()) {
    try {
      await db.mistakeFamily.updateMany({
        where: { userId: u, tag, id: { not: familyId(u, "placement", tag) } },
        data: { streakClean: 0, resolvedAt: null },
      });
    } catch {
      // Memory must never break the result the learner is waiting for.
    }
    await noteTagOutcome(tag, false, u);
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, label: labelFor(tag, "placement"), count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// ---------- learner-memory corrections (audit P2, Task 65) ----------

export interface CorrectPatch {
  label?: string;
  evidence?: string; // "wrong -> right"
}

// The learner fixes what the memory quotes. Only label/evidence are editable:
// the tag is the taxonomy key every other surface (mastery ledger, exam
// builder, tutor prompt) aims with - relabeling it would silently detach the
// family from the machinery that heals it. editedAt marks provenance.
export async function correctFamily(id: string, patch: CorrectPatch, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const u = await actor(userId);
  if (!id) return { ok: false, error: "id required" };
  const data: { label?: string; evidence?: string; editedAt: Date } = { editedAt: new Date() };
  if (patch.label !== undefined) {
    const label = patch.label.trim().slice(0, 120);
    if (!label) return { ok: false, error: "label cannot be empty" };
    data.label = label;
  }
  if (patch.evidence !== undefined) {
    const ev = patch.evidence.trim().slice(0, 300);
    if (!ev.includes("->")) return { ok: false, error: 'evidence must be "wrong -> right"' };
    const [w, ...rest] = ev.split("->");
    const r = rest.join("->").trim();
    if (!w.trim() || !r) return { ok: false, error: "evidence needs both sides" };
    data.evidence = `${w.trim().slice(0, 140)} -> ${r.slice(0, 140)}`;
  }
  try {
    const res = await db.mistakeFamily.updateMany({ where: { id, userId: u }, data });
    return res.count === 1 ? { ok: true } : { ok: false, error: "family not found in your memory" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Forgive & forget with a tombstone: the family leaves the memory and the
// exact evidence pair is recorded as rejected. The same pair cannot re-aggregate
// (see recordMistakes); a different pair under the same tag can.
export async function forgetFamily(id: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const u = await actor(userId);
  if (!id) return { ok: false, error: "id required" };
  try {
    const fam = await db.mistakeFamily.findFirst({ where: { id, userId: u } });
    if (!fam) return { ok: false, error: "family not found in your memory" };
    const [wrong, ...rest] = fam.evidence.split("->");
    const hash = evidenceHash(wrong.trim(), rest.join("->").trim());
    await db.$transaction([
      db.mistakeFamily.delete({ where: { id: fam.id } }),
      db.mistakeForgiven.upsert({
        where: { id: fam.id },
        create: { id: fam.id, userId: u, kind: fam.kind, tag: fam.tag, evidenceHash: hash },
        update: { evidenceHash: hash, at: new Date() },
      }),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
