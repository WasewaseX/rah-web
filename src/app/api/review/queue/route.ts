import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DECK, cardById, type Card } from "@/lib/content";
import { dayIndex, cardR, defaultState, type FsrsState } from "@/lib/fsrs";
import { getLearner, queueCounts } from "@/lib/server";
import { materialCardById } from "@/lib/materials";
import { derivedExamCard } from "@/lib/exam-cards";
import { bankTiles } from "@/lib/bank";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// Retrieval directions per card kind. Rotating through these is the
// multi-direction retrieval loop: same item, different recall road.
// `bank` is the word-bank translate pass (DUOLINGO-RE.md D2): build the
// English sentence from tiles instead of typing it.
export function directionsFor(kind: string): string[] {
  switch (kind) {
    case "cloze":
      return ["cloze", "reverse", "fa2en", "audio", "bank"];
    case "sent":
      return ["cloze", "audio", "bank"];
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

// New cards used to be introduced in file order - and the file opens with 40
// straight collocation cards, so a learner's first week of reviews was 100%
// collocation and they never met grammar or plain vocabulary. This rotates
// across skills 2 vocabulary : 1 collocation : 1 grammar (the deck's own mix,
// 107/57/54), so every introduction day mixes all three.
export function interleaveBySkill(unseen: Card[], budget: number): Card[] {
  const pools: Record<string, Card[]> = { vocabulary: [], collocation: [], grammar: [] };
  for (const c of shuffle(unseen)) if (pools[c.skill]) pools[c.skill].push(c);
  const cycle = ["vocabulary", "collocation", "vocabulary", "grammar"];
  const out: Card[] = [];
  let k = 0;
  while (out.length < budget) {
    const pick = pools[cycle[k % cycle.length]].shift();
    if (pick) {
      out.push(pick);
    } else {
      // This skill ran dry: fall back to the fullest remaining pool.
      const rest = Object.values(pools)
        .filter((p) => p.length > 0)
        .sort((a, b) => b.length - a.length);
      if (!rest.length) break;
      out.push(rest[0].shift()!);
    }
    k++;
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ahead = url.searchParams.get("ahead") === "1";
  const today = dayIndex();
  const all = await db.cardState.findMany({ where: { userId: await contentUserId(req).catch(() => "me") } });
  const byId = new Map(all.map((s) => [s.cardId, s]));
  const l = await getLearner();

  let pool: Card[] = [];
  // Task 89 perf: `all` was already loaded above - passing it here removes the
  // second full CardState scan this route used to pay on every request.
  const counts = await queueCounts(all);
  let mode: "normal" | "ahead" = "normal";

  if (ahead) {
    // Extra practice: the learner asked for more after the scheduled round.
    // Serve the soonest-coming-back known cards (not yet due). FSRS folds an
    // early review into the schedule normally - it is safe, just optional.
    // The 40 soonest are shuffled so consecutive extra rounds do not repeat
    // the exact same order; the due-first bias still holds for big backlogs.
    const soonest = all
      .filter((s) => !s.suspended && s.state !== "new" && s.due > today)
      .sort((a, b) => a.due - b.due || cardR(a as unknown as FsrsState, today) - cardR(b as unknown as FsrsState, today))
      .slice(0, 40);
    pool = shuffle(
      (
        await Promise.all(
          soonest.map(async (s) => cardById(s.cardId) ?? (await derivedExamCard(s.cardId)) ?? (await materialCardById(s.cardId))),
        )
      ).filter((c): c is Card => !!c),
    );
    mode = "ahead";
  } else {
    // Due: known cards past their schedule, most at-risk first.
    const dueStates = all
      .filter((s) => !s.suspended && s.state !== "new" && s.due <= today)
      .sort(
        (a, b) => cardR(a as unknown as FsrsState, today) - cardR(b as unknown as FsrsState, today),
      );

    // New budget: cards never reviewed, limited per day (shared counter).
    // BYO-material cards come FIRST in the new pool - the learner's own
    // content is the priority - and share the same budget so the Home badge
    // promise (due + newLeft) stays exactly what one round delivers.
    const matNewStates = all
      .filter((s) => s.cardId.startsWith("mat:") && !s.suspended && s.state === "new")
      .sort((a, b) => a.due - b.due);
    const matNewCards = (
      await Promise.all(matNewStates.map((s) => materialCardById(s.cardId)))
    ).filter((c): c is Card => !!c);
    const deckNewBudget = Math.max(0, counts.newLeft - matNewCards.length);
    const newCards = [
      ...matNewCards,
      ...interleaveBySkill(
        DECK.filter((c) => {
          const s = byId.get(c.id);
          return !s || s.state === "new";
        }),
        deckNewBudget,
      ),
    ];

    // Interleave: 2 due for every 1 new, shuffled inside each pool so skills mix.
    // Deck cards resolve from content; exam:<tag> healing cards (written by the
    // exam->FSRS bridge) resolve at queue time from the family's own recorded
    // evidence; mat:<id> BYO-material cards resolve from the imported material.
    // A family with no evidence or no unblankable correction drops out honestly
    // instead of rendering a broken card.
    const dueCards = (
      await Promise.all(
        dueStates.map(async (s) =>
          cardById(s.cardId) ?? (await derivedExamCard(s.cardId)) ?? (await materialCardById(s.cardId)),
        ),
      )
    ).filter((c): c is Card => !!c);
    const d = shuffle(dueCards);
    const n = shuffle(newCards);
    let i = 0;
    let j = 0;
    while (i < d.length || j < n.length) {
      if (i < d.length) pool.push(d[i++]);
      if (i < d.length) pool.push(d[i++]);
      if (j < n.length) pool.push(n[j++]);
    }
  }

  const batch = pool.slice(0, 20).map((c) => {
    const st = byId.get(c.id);
    const state = st ?? defaultState();
    const dir = nextDir(c, st?.dir ?? "");
    return { card: c, state, dir, tiles: dir === "bank" ? bankTiles(c, today) : [], ahead: mode === "ahead" };
  });

  return NextResponse.json({
    batch,
    mode,
    counts: { ...counts },
  });
}
