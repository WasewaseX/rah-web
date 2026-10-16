// Shared item builders for the arcade games. Deterministic pools built from
// the verified DECK (218 cards with distractors and trap tags), biased toward
// the learner's active mistake-family tags so the games hunt the same leaks
// the coach does. No AI latency: the keys ship to the client and the game
// grades locally; the server only sanity-checks the submitted result.

import { DECK, type Card } from "@/lib/content";
import { topMistakes } from "@/lib/mistakes";

export interface ArcadeItem {
  id: string;
  kind: "cloze" | "mcq";
  q: string;
  hint?: string; // shown after answering (the full English chunk)
  choices?: string[]; // mcq only, shuffled
  key: string; // correct answer (cloze: the blank; mcq: the choice text)
  accepts: string[]; // cloze normalized accepts
  note?: string;
  tag?: string; // the trap this item drills (for the miss report)
}

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Cards whose traps overlap the learner's active families come first; the
// rest of the pool is padded with random cards.
async function prioritizedCards(count: number, favoredTags: string[]): Promise<Card[]> {
  let cards: Card[] = [];
  if (favoredTags.length > 0) {
    const hot = DECK.filter((c) => c.traps.some((t) => favoredTags.includes(t)));
    cards = shuffle(hot);
  }
  if (cards.length < count) {
    const rest = shuffle(DECK.filter((c) => !cards.includes(c)));
    cards = [...cards, ...rest];
  }
  return cards.slice(0, count);
}

function toMcq(c: Card): ArcadeItem {
  const wrong = new Set<string>();
  for (const d of c.distractors ?? []) if (d && d !== c.fa) wrong.add(d);
  if (wrong.size < 3) {
    for (const other of shuffle(DECK.filter((x) => x.fa !== c.fa))) {
      if (wrong.size >= 3) break;
      if (other.fa !== c.fa) wrong.add(other.fa);
    }
  }
  const choices = shuffle([c.fa, ...[...wrong].slice(0, 3)]);
  return {
    id: `${c.id}:mcq`,
    kind: "mcq",
    q: c.en,
    hint: c.fa,
    choices,
    key: c.fa,
    accepts: [c.fa],
    note: c.note || undefined,
    tag: c.traps[0] ?? undefined,
  };
}

function toCloze(c: Card): ArcadeItem {
  // Only cards with a real blank work as cloze.
  if (c.kind === "cloze" && c.prompt.includes("___")) {
    return {
      id: `${c.id}:cloze`,
      kind: "cloze",
      q: c.prompt,
      hint: c.en,
      key: c.answer,
      accepts: [c.answer, ...(c.alt ?? [])].map(normalize).filter(Boolean),
      note: c.note || undefined,
      tag: c.traps[0] ?? undefined,
    };
  }
  // Otherwise build a meaning-write item: given the Farsi, produce the English.
  return {
    id: `${c.id}:prod`,
    kind: "cloze",
    q: c.fa,
    hint: c.en,
    key: c.en,
    accepts: [c.en, ...(c.alt ?? [])].map(normalize).filter(Boolean),
    note: c.note || undefined,
    tag: c.traps[0] ?? undefined,
  };
}

export async function buildSpeedPool(count: number): Promise<ArcadeItem[]> {
  const fams = await topMistakes(10).catch(() => []);
  const favoredTags = fams.filter((f) => !f.resolvedAt).map((f) => f.tag);
  const cards = await prioritizedCards(count, favoredTags);
  return cards.map((c, i) => (i % 10 < 3 ? toCloze(c) : toMcq(c)));
}

export interface BossPhase {
  n: number;
  name: string;
  taunt: string;
  items: ArcadeItem[];
}

const PHASE_META = [
  { name: "The Warm-Up", taunt: "You call that preparation? I have graded a thousand like you." },
  { name: "The Grind", taunt: "Still here? Good. I was getting bored of winning." },
  { name: "The Verdict", taunt: "This is where every learner before you folded. Show me you are different." },
] as const;

export async function buildBossFight(itemsPerPhase: number, phases: number): Promise<BossPhase[]> {
  const fams = await topMistakes(10).catch(() => []);
  const favoredTags = fams.filter((f) => !f.resolvedAt).map((f) => f.tag);
  const total = phases * itemsPerPhase;
  const cards = await prioritizedCards(total, favoredTags);
  const out: BossPhase[] = [];
  for (let p = 0; p < phases; p++) {
    const meta = PHASE_META[p % PHASE_META.length];
    const items = cards.slice(p * itemsPerPhase, (p + 1) * itemsPerPhase).map((c, i) => ((p + i) % 3 === 2 ? toCloze(c) : toMcq(c)));
    out.push({ n: p + 1, name: meta.name, taunt: meta.taunt, items });
  }
  return out;
}

export function normalizeAnswer(s: string): string {
  return normalize(s);
}
