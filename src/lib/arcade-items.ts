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
  // Data guard: a cloze card with a blank but no key can never be answered,
  // and any card with neither answer nor English cannot become an item at
  // all - drop both wherever they would land.
  const usable = (c: Card) =>
    Boolean(c.answer || c.en) && !(c.kind === "cloze" && c.prompt.includes("___") && !c.answer.trim());
  let cards: Card[] = [];
  if (favoredTags.length > 0) {
    const hot = DECK.filter((c) => usable(c) && c.traps.some((t) => favoredTags.includes(t)));
    cards = shuffle(hot);
  }
  if (cards.length < count) {
    const rest = shuffle(DECK.filter((c) => usable(c) && !cards.includes(c)));
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
    // Normalized to match how graders compare: normalizeAnswer(pick) must be
    // an exact member of accepts, so punctuation-heavy Persian keys
    // ("کتاب (بعد از عدد جمع می‌آید)") grade correctly.
    accepts: [c.fa].map(normalize).filter(Boolean),
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

// ---------- Seeded builders for the server-graded games (Dungeon, Duel,
// Gauntlet). Same seed = same run, so the Daily Dungeon is identical all day
// and the Duel's rival par refers to the exact items you faced. ----------

function seededShuffle<T>(a: T[], seed: number): T[] {
  const out = [...a];
  let s = (seed * 2654435761) % 4294967296;
  const rnd = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function weakTags(): Promise<string[]> {
  const fams = await topMistakes(10).catch(() => []);
  return fams.filter((f) => !f.resolvedAt).map((f) => f.tag);
}

export interface DungeonFloor {
  n: number;
  name: string;
  items: ArcadeItem[];
}

const FLOOR_META = [
  { name: "The Gate", pick: 0 },
  { name: "The Long Dark", pick: 1 },
  { name: "The Vault", pick: 2 },
] as const;

// The Daily Dungeon: 3 floors x 4 items, seeded by the day index so every
// attempt today walks the same rooms. Difficulty climbs floor by floor and
// weak-tag cards are stacked into the deep floors where they hurt most.
export async function buildDungeonFloors(day: number, band = "B2"): Promise<DungeonFloor[]> {
  const favored = await weakTags();
  const hot = DECK.filter((c) => c.traps.some((t) => favored.includes(t)));
  const b1 = DECK.filter((c) => ["A2", "B1"].includes(c.level));
  const b2 = DECK.filter((c) => c.level === "B2");
  const c1 = DECK.filter((c) => c.level === "C1");
  const hotPool = seededShuffle(hot, day);
  const rest = seededShuffle(DECK.filter((c) => !hot.includes(c)), day + 1);
  const fill = (n: number, pool: Card[], start: number): Card[] => {
    const out: Card[] = [];
    for (const c of pool) {
      if (out.length >= n) break;
      if (!out.includes(c) && !hotPool.slice(0, start).includes(c)) out.push(c);
    }
    for (const c of rest) {
      if (out.length >= n) break;
      if (!out.includes(c)) out.push(c);
    }
    return out;
  };
  const floors: DungeonFloor[] = [];
  // P3: the band sets the staircase's FLOOR, not just its ceiling. A2/B1
  // learners climb on B1/B2 material with C1 as spice; C1 learners get C1
  // mixed in from the first floor. B2 keeps the classic staircase.
  const lowBand = band === "A2" || band === "B1";
  const highBand = band === "C1";
  const floor3Pool = lowBand
    ? [...seededShuffle(b2, day + 4), ...seededShuffle(c1, day + 5), ...rest]
    : [...seededShuffle(c1.length ? c1 : b2, day + 4), ...rest];
  const floor1Pool = highBand
    ? [...seededShuffle([...b2, ...c1], day + 2), ...rest]
    : [...seededShuffle(b1, day + 2), ...rest];
  const plans = [
    { cards: floor1Pool, kind: 0, meta: FLOOR_META[0] },
    { cards: [...hotPool.slice(0, 6), ...seededShuffle(b2, day + 3), ...rest], kind: 1, meta: FLOOR_META[1] },
    { cards: [...hotPool.slice(2, 10), ...floor3Pool], kind: 2, meta: FLOOR_META[2] },
  ];
  let used = new Set<string>();
  for (const p of plans) {
    const picked: Card[] = [];
    for (const c of p.cards) {
      if (picked.length >= 4) break;
      if (used.has(c.id)) continue;
      used.add(c.id);
      picked.push(c);
    }
    const items = picked.map((c, i) => ((p.kind + i) % 3 === 2 ? toCloze(c) : toMcq(c)));
    floors.push({ n: floors.length + 1, name: p.meta.name, items });
  }
  return floors;
}

// Rival par for a duel: deterministic per run seed, calibrated so the rival
// hits roughly the learner's own recent accuracy band with seeded jitter.
export function duelPar(seed: number, items: number, accuracy: number): number {
  let hits = 0;
  for (let i = 0; i < items; i++) {
    const p = Math.min(0.92, Math.max(0.3, accuracy + (seededUnit2(seed * 97 + i * 13) - 0.5) * 0.3));
    if (seededUnit2(seed * 31 + i * 7) < p) hits++;
  }
  return hits;
}

function seededUnit2(n: number): number {
  let s = (n * 2654435761) % 4294967296;
  s = (s * 1103515245 + 12345) % 2147483648;
  return s / 2147483648;
}

// The Gauntlet draws its next item from an escalating pool: as the streak
// climbs, easy cards drain away and the learner's worst tags take over.
export async function buildGauntletItem(streak: number, seed: number): Promise<ArcadeItem> {
  const favored = await weakTags();
  const hot = DECK.filter((c) => c.traps.some((t) => favored.includes(t)));
  const easy = DECK.filter((c) => ["A2", "B1"].includes(c.level));
  const mid = DECK.filter((c) => c.level === "B2");
  const hard = DECK.filter((c) => c.level === "C1");
  let pool: Card[];
  if (streak < 5) pool = [...easy, ...mid];
  else if (streak < 10) pool = [...mid, ...easy.slice(0, 20)];
  else if (streak < 15) pool = [...hard.length ? hard : mid, ...mid];
  else pool = hot.length >= 5 ? [...hot, ...(hard.length ? hard : mid)] : [...(hard.length ? hard : mid), ...mid];
  const shuffled = seededShuffle(pool, seed * 7 + streak * 13 + 1);
  const c = shuffled[0] ?? seededShuffle(DECK, seed + streak)[0];
  return streak >= 8 && streak % 2 === 0 ? toCloze(c) : toMcq(c);
}
