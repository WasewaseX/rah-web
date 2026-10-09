// Mistake memory. Every production correction (chat, essay, speaking) carries
// a trap tag from the Farsi-interference taxonomy; this module folds those
// tags into persistent families so a recurring weakness is visible to the
// tutor, the examiner and the progress page - and so practice hunts the leak
// instead of rediscovering it every session.

import { db } from "@/lib/db";

export interface MistakeInput {
  kind: "chat" | "writing" | "speak" | "exam";
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

function labelFor(tag: string, kind: string): string {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  const pretty = tag.replace(/_/g, " ");
  return `${pretty.charAt(0).toUpperCase()}${pretty.slice(1)} recurring in ${kind}`;
}

// Record production mistakes. Only tagged corrections aggregate; "none" or
// empty tags are skipped so unclassifiable noise never invents fake families.
export async function recordMistakes(items: MistakeInput[]): Promise<void> {
  const grouped = new Map<string, MistakeInput & { tag: string }>();
  for (const item of items) {
    const tag = normalizeTag(item.tag);
    if (!tag || tag === "none" || !item.wrong?.trim() || !item.right?.trim()) continue;
    const key = `${item.kind}:${tag}`;
    const existing = grouped.get(key);
    if (!existing) grouped.set(key, { ...item, tag });
  }
  for (const [key, m] of grouped) {
    const evidence = `${m.wrong.trim().slice(0, 140)} -> ${m.right.trim().slice(0, 140)}`;
    try {
      await db.mistakeFamily.upsert({
        where: { id: key },
        create: {
          id: key,
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
}

function toView(r: {
  id: string; kind: string; tag: string; label: string; count: number;
  evidence: string; lastSeen: Date; streakClean: number; resolvedAt: Date | null;
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
  };
}

// activeOnly=true feeds prompts and exams: a resolved family stays in the
// history view but must stop steering what the tutor hunts and what the
// examiner builds - that is the whole point of healing.
export async function topMistakes(limit = 6, activeOnly = false): Promise<MistakeFamilyView[]> {
  const rows = await db.mistakeFamily.findMany({
    where: activeOnly ? { resolvedAt: null } : undefined,
    orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
    take: limit,
  });
  return rows.map(toView);
}

// The healing loop's exam side. Weakness-targeted exam items carry their
// family tag; grading reports each answer here. A correct answer extends the
// clean streak toward retirement; a miss is fresh relapse evidence that
// reopens every family under that tag and records an exam-side family.
export async function noteExamAnswer(tag: string, wrong: string, right: string, correct: boolean): Promise<void> {
  const t = normalizeTag(tag);
  if (!t) return;
  try {
    if (correct) {
      await db.mistakeFamily.updateMany({
        where: { tag: t },
        data: { streakClean: { increment: 1 } },
      });
      const due = await db.mistakeFamily.findMany({ where: { tag: t, resolvedAt: null, streakClean: { gte: CLEAN_HITS_TO_RESOLVE } } });
      for (const f of due) {
        await db.mistakeFamily.update({ where: { id: f.id }, data: { resolvedAt: new Date() } });
      }
    } else {
      // An exam miss is production evidence too: it counts, it shows, and it
      // reopens every healed family sharing the tag.
      await recordMistakes([{ kind: "exam", tag: t, wrong: wrong.slice(0, 140) || "(blank)", right: right.slice(0, 140) }]);
      await db.mistakeFamily.updateMany({
        where: { tag: t, id: { not: `exam:${t}` } },
        data: { streakClean: 0, resolvedAt: null },
      });
    }
  } catch {
    // Memory must never break the grading turn that fed it.
  }
}
