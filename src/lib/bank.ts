// Word-bank translate (Duolingo's signature tile exercise), reverse
// engineered into Rah's review loop as the `bank` direction: prompt is the
// Farsi sentence, the learner builds the English by tapping tiles.
//
// House rules: the engine constructs, the AI never invents the answer key.
// Tiles are DETERMINISTIC per (card, day) - the same day always renders the
// same tray, so the drive can assert on it and reruns are reproducible.
// Every target word is always present (the answer is always buildable);
// distractors are noise that can only mislead, never enable a second valid
// build (grading compares the built string against the target + alts).

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

const MAX_TILES = 14;
const MIN_DISTRACTORS = 5;

// The tile tray for one card on one day. Deterministic: same inputs, same
// tray, always. Distractor words come from the card's own distractor field
// first, then from other cards' English (same level preferred) when the
// field is thin - the deck's data holes can never produce a broken tray.
export function bankTiles(card: Card, day: number): string[] {
  const target = card.en.split(/\s+/).filter(Boolean);
  const rng = mulberry32(hashStr(`${card.id}:${day}`));

  const seen = new Set(target.map((w) => w.toLowerCase()));
  const distractors: string[] = [];
  const push = (w: string) => {
    const k = w.toLowerCase().trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    distractors.push(w.trim());
  };

  for (const w of card.distractors ?? []) push(w);
  if (distractors.length < MIN_DISTRACTORS) {
    // deterministic deck-wide top-up, same-level words first
    const pool = seededShuffle(
      DECK.filter((c) => c.id !== card.id && c.en !== card.en),
      rng,
    );
    const sameLevel = pool.filter((c) => c.level === card.level);
    const rest = pool.filter((c) => c.level !== card.level);
    outer: for (const c of [...sameLevel, ...rest]) {
      for (const w of c.en.split(/\s+/)) {
        push(w);
        if (distractors.length >= MIN_DISTRACTORS) break outer;
      }
    }
  }

  // cap distractors so long sentences never explode the tray
  const distCap = Math.max(0, MAX_TILES - target.length);
  const tiles = seededShuffle([...target, ...distractors.slice(0, distCap)], rng);
  return tiles;
}
