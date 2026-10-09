import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DECK, cardById, type Card } from "@/lib/content";
import { dayIndex, cardR, defaultState, type FsrsState } from "@/lib/fsrs";
import { getLearner } from "@/lib/server";

export const dynamic = "force-dynamic";

// Retrieval directions per card kind. Rotating through these is the
// multi-direction retrieval loop: same item, different recall road.
export function directionsFor(kind: string): string[] {
  switch (kind) {
    case "cloze":
      return ["cloze", "reverse", "fa2en", "audio"];
    case "sent":
      return ["cloze", "audio"];
    case "ef":
      return ["mcq_fa", "fae", "audio"];
    case "fae":
      return ["fae", "mcq_fa", "audio"];
    default:
      return ["cloze"];
  }
}

function nextDir(card: Card, lastDir: string): string {
  const dirs = directionsFor(card.kind);
  if (!lastDir) return dirs[0];
  const i = dirs.indexOf(lastDir);
  return dirs[(i + 1) % dirs.length];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  const l = await getLearner();
  const today = dayIndex();
  const all = await db.cardState.findMany();
  const byId = new Map(all.map((s) => [s.cardId, s]));

  // Due: known cards past their schedule, most at-risk first.
  const dueStates = all
    .filter((s) => !s.suspended && s.state !== "new" && s.due <= today)
    .sort(
      (a, b) => cardR(a as unknown as FsrsState, today) - cardR(b as unknown as FsrsState, today),
    );

  // New budget: cards never reviewed, limited per day.
  const introducedToday = all.filter((s) => s.last === today && s.reps === 1).length;
  const known = all.filter((s) => s.state !== "new").length;
  const newBudget = Math.max(0, Math.min(l.newPerDay - introducedToday, DECK.length - known));
  const newCards = DECK.filter((c) => {
    const s = byId.get(c.id);
    return !s || s.state === "new";
  }).slice(0, newBudget);

  // Interleave: 2 due for every 1 new, shuffled inside each pool so skills mix.
  const dueCards = dueStates.map((s) => cardById(s.cardId)).filter((c): c is Card => !!c);
  const pool: Card[] = [];
  const d = shuffle(dueCards);
  const n = shuffle(newCards);
  let i = 0;
  let j = 0;
  while (i < d.length || j < n.length) {
    if (i < d.length) pool.push(d[i++]);
    if (i < d.length) pool.push(d[i++]);
    if (j < n.length) pool.push(n[j++]);
  }

  const batch = pool.slice(0, 20).map((c) => {
    const st = byId.get(c.id);
    const state = st ?? defaultState();
    const dir = nextDir(c, st?.dir ?? "");
    return { card: c, state, dir };
  });

  return NextResponse.json({
    batch,
    counts: { due: dueStates.length, newLeft: newBudget, reviewedToday: introducedToday },
  });
}
