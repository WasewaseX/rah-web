// Gems economy + Shop - the Duolingo reverse-engineering slice.
// Gems are the soft currency: earned from level-ups (30), finished quests (10),
// and weekly league payouts; spent on streak freezes and XP boosts.
// Boost math lives in awardXp (the single XP faucet) so every surface doubles
// honestly; purchases live here so the ledger stays in one place.

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";

export const GEMS = {
  levelUp: 30,
  questDone: 10,
  leagueFinish: 25,
  goalHit: 5,
} as const;

export const SHOP_ITEMS = [
  {
    key: "streak_freeze",
    title: "Streak Freeze",
    desc: "Banks one freeze. A missed day consumes it instead of breaking your chain (cap 2, 3 with the Deep Freezer talent).",
    cost: 100,
  },
  {
    key: "xp_boost",
    title: "XP Boost x2",
    desc: "Every XP payout doubles until the end of tomorrow. Stacks after momentum heat and talents.",
    cost: 150,
  },
] as const;

export type ShopKey = (typeof SHOP_ITEMS)[number]["key"];

export async function awardGems(amount: number): Promise<number> {
  const inc = Math.max(0, Math.min(500, Math.round(amount)));
  const l = await db.learner.upsert({
    where: { id: "me" },
    create: { id: "me", gems: inc },
    update: { gems: { increment: inc } },
  });
  return l.gems;
}

export function boostActive(boostUntil: number): boolean {
  return boostUntil >= dayIndex();
}

export interface BuyResult {
  ok: boolean;
  error?: string;
  gems?: number;
  title?: string;
  desc?: string;
}

export async function buyItem(key: string): Promise<BuyResult> {
  const item = SHOP_ITEMS.find((i) => i.key === key);
  if (!item) return { ok: false, error: "No such item in the shop." };
  const l = await db.learner.findUnique({ where: { id: "me" } });
  if (!l) return { ok: false, error: "Learner not initialized." };
  if (l.gems < item.cost) {
    return { ok: false, error: `Not enough gems: need ${item.cost}, you have ${l.gems}.` };
  }

  if (key === "streak_freeze") {
    const cap = l.perks.includes("freeze_cap") ? 3 : 2;
    if (l.freezes >= cap) {
      return { ok: false, error: `Freeze bank is full (${l.freezes}/${cap}).` };
    }
    const updated = await db.learner.update({
      where: { id: "me" },
      data: { gems: { decrement: item.cost }, freezes: { increment: 1 } },
    });
    return { ok: true, gems: updated.gems, title: item.title, desc: `Banked. Freezes: ${updated.freezes}/${cap}.` };
  }

  if (key === "xp_boost") {
    const today = dayIndex();
    if (boostActive(l.boostUntil)) {
      return { ok: false, error: "A boost is already running - let it finish first." };
    }
    const updated = await db.learner.update({
      where: { id: "me" },
      data: { gems: { decrement: item.cost }, boostUntil: today + 1 },
    });
    return { ok: true, gems: updated.gems, title: item.title, desc: "2x XP live until the end of tomorrow." };
  }

  return { ok: false, error: "Item exists but has no purchase handler - that is a bug." };
}

export function shopView(gems: number, freezes: number, boostUntil: number) {
  return {
    gems,
    boostActive: boostActive(boostUntil),
    items: SHOP_ITEMS.map((i) => ({ ...i, affordable: gems >= i.cost })),
    freezes,
  };
}
