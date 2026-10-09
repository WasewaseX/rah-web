// Mistake memory. Every production correction (chat, essay, speaking) carries
// a trap tag from the Farsi-interference taxonomy; this module folds those
// tags into persistent families so a recurring weakness is visible to the
// tutor, the examiner and the progress page - and so practice hunts the leak
// instead of rediscovering it every session.

import { db } from "@/lib/db";

export interface MistakeInput {
  kind: "chat" | "writing" | "speak";
  tag: string; // raw trap tag from the model, e.g. "statives", "none"
  wrong: string;
  right: string;
}

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
}

export async function topMistakes(limit = 6): Promise<MistakeFamilyView[]> {
  const rows = await db.mistakeFamily.findMany({
    orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    tag: r.tag,
    label: r.label,
    count: r.count,
    evidence: r.evidence,
    lastSeen: r.lastSeen.toISOString(),
  }));
}
