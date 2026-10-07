import deckJson from "@/content/deck.json";
import placementJson from "@/content/placement.json";
import readingsJson from "@/content/readings.json";

export interface Card {
  id: string;
  unit: string;
  skill: string;
  level: string;
  kind: string; // cloze | ef | fae | sent
  prompt: string;
  answer: string;
  alt: string[];
  en: string;
  fa: string;
  note: string;
  traps: string[];
  distractors: string[];
}

export interface PlacementItem {
  id: string;
  sec: string;
  rung: string;
  q: string;
  choices: string[];
  a: string;
  trap: string;
}

export interface Reading {
  id: string;
  title: string;
  level: string;
  minutes: number;
  text: string;
}

export const DECK: Card[] = (deckJson as { cards: Card[] }).cards;
export const PLACEMENT_ITEMS: PlacementItem[] = (placementJson as { items: PlacementItem[] }).items;
export const READINGS: Reading[] = (readingsJson as { readings: Reading[] }).readings;

export const cardById = (id: string): Card | undefined => DECK.find((c) => c.id === id);

export const SKILLS = ["vocabulary", "collocation", "grammar"] as const;

export function deckStats() {
  const byLevel: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  for (const c of DECK) {
    byLevel[c.level] = (byLevel[c.level] ?? 0) + 1;
    byUnit[c.unit] = (byUnit[c.unit] ?? 0) + 1;
  }
  return { total: DECK.length, byLevel, byUnit };
}
