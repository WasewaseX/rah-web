import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardXp, bumpStat, progressQuest, registerHit, registerMiss, hasPerk, learnerPerks } from "@/lib/arcade";
import { buildGauntletItem, normalizeAnswer } from "@/lib/arcade-items";

export const dynamic = "force-dynamic";

interface GauntletState {
  seed: number;
  streak: number;
  shieldUsed: boolean;
  done: boolean;
  item: Awaited<ReturnType<typeof buildGauntletItem>>; // server-side, key withheld
}

async function loadRun(): Promise<{ id: string; state: GauntletState }> {
  const row = await db.runState.findUnique({ where: { id: "gauntlet" } });
  if (row) {
    try {
      const state = JSON.parse(row.state) as GauntletState;
      if (state.item && Number.isFinite(state.seed)) return { id: "gauntlet", state };
    } catch {
      // fall through: rebuild
    }
  }
  return resetRun();
}

async function resetRun(): Promise<{ id: string; state: GauntletState }> {
  const seed = Math.floor(Date.now() / 1000) % 2_000_000_000;
  const item = await buildGauntletItem(0, seed);
  const state: GauntletState = { seed, streak: 0, shieldUsed: false, done: false, item };
  await db.runState.upsert({ where: { id: "gauntlet" }, create: { id: "gauntlet", state: JSON.stringify(state) }, update: { state: JSON.stringify(state) } });
  return { id: "gauntlet", state };
}

function publicItem(state: GauntletState) {
  const { key: _key, accepts: _accepts, ...rest } = state.item;
  void _key;
  void _accepts;
  return rest;
}

export async function GET() {
  const { state } = await loadRun();
  const best = (await db.gameStat.findUnique({ where: { key: "gauntlet:best" } }))?.best ?? 0;
  return NextResponse.json({
    ...publicItem(state),
    streak: state.streak,
    shieldUsed: state.shieldUsed,
    shielded: hasPerk((await db.learner.findUnique({ where: { id: "me" } }))?.perks ?? "", "chain_shield"),
    done: state.done,
    best,
  });
}

export async function POST(req: Request) {
  const b = (await req.json()) as { pick?: string };
  const { id, state } = await loadRun();
  if (state.done) return NextResponse.json({ error: "run over", streak: state.streak }, { status: 400 });
  const correct = state.item.accepts.includes(normalizeAnswer(String(b.pick ?? "")));
  if (correct) {
    state.streak += 1;
    await registerHit();
    state.item = await buildGauntletItem(state.streak, state.seed);
    await db.runState.update({ where: { id }, data: { state: JSON.stringify(state) } });
    return NextResponse.json({ correct: true, streak: state.streak, next: publicItem(state) });
  }
  // A miss ends the run - unless the Chain Shield talent still has its
  // once-per-run save, in which case the streak lives on.
  const perks = await learnerPerks();
  if (perks.includes("chain_shield") && !state.shieldUsed) {
    state.shieldUsed = true;
    state.streak += 1;
    state.item = await buildGauntletItem(state.streak, state.seed);
    await db.runState.update({ where: { id }, data: { state: JSON.stringify(state) } });
    return NextResponse.json({ correct: false, saved: true, streak: state.streak, next: publicItem(state) });
  }
  state.done = true;
  await db.runState.update({ where: { id }, data: { state: JSON.stringify(state) } });
  const streak = state.streak;
  const gain = streak * 8;
  await bumpStat("gauntlet:best", streak);
  await bumpStat("gauntlet:runs");
  await progressQuest("gauntlet_10", streak);
  let xpResult;
  if (gain > 0) xpResult = await awardXp(gain, { chainHit: false });
  await registerMiss();
  return NextResponse.json({ correct: false, saved: false, streak, xpGain: gain, totalXp: xpResult?.total, unlocked: xpResult?.unlocked ?? [] });
}
