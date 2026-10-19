// Match-pairs sprint (DUOLINGO-RE.md D3, the spec'd-not-started wave item):
// Duolingo's tap-the-pairs speed drill, rebuilt the Rah way.
//
// House rules, same as bank.ts: the engine constructs, the AI never invents
// the answer key. The board is DETERMINISTIC per (due set, day) - the same
// learner state on the same day always renders the same board, so gates can
// assert on it and reruns are reproducible. Left column Farsi, right column
// English; grading happens in the learner's hands (a successful match is a
// retrieval), and each matched pair feeds /api/review/grade so FSRS sees the
// card exactly as it would from any other direction.

import { DECK, type Card } from "@/lib/content";

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface PairSide {
  id: string; // card id
  text: string;
}

export interface PairBoard {
  left: PairSide[]; // Farsi prompts
  right: PairSide[]; // English meanings (independently shuffled)
  size: number;
}

export const PAIRS_COUNT = 5;

// Build a deterministic board. dueCards: the learner's due Card objects
// (engine-chosen, most at-risk first). Fill from the same level, then the
// whole deck, always deduped by Farsi text so no two pairs share a tile.
export function buildPairs(dueCards: Card[], day: number, count = PAIRS_COUNT): PairBoard {
  const seen = new Set<string>();
  const picked: Card[] = [];
  const push = (c: Card | undefined): boolean => {
    if (!c || seen.has(c.fa) || picked.length >= count) return false;
    if (!c.fa.trim() || !c.en.trim()) return false;
    seen.add(c.fa);
    picked.push(c);
    return true;
  };

  for (const c of dueCards) push(c);
  if (picked.length < count) {
    const level = picked[0]?.level;
    for (const c of seededShuffle(DECK.filter((d) => d.level === level), mulberry32(hashStr(`pairs-lv-${day}`)))) push(c);
  }
  if (picked.length < count) {
    for (const c of seededShuffle(DECK, mulberry32(hashStr(`pairs-all-${day}`)))) push(c);
  }

  const rng = mulberry32(hashStr(`pairs-${day}-${picked.map((c) => c.id).join(",")}`));
  const left = seededShuffle(
    picked.map((c) => ({ id: c.id, text: c.fa })),
    rng,
  );
  const right = seededShuffle(
    picked.map((c) => ({ id: c.id, text: c.en })),
    mulberry32(hashStr(`pairs-r-${day}-${picked.map((c) => c.id).join(",")}`)),
  );
  return { left, right, size: picked.length };
}
