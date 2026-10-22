import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { getLearner } from "@/lib/server";
import { ladderFor } from "@/lib/ladder";
import { awardGameXp, bumpStat, progressQuest, registerMiss, hasPerk, learnerPerks } from "@/lib/arcade";
import { buildDungeonFloors, normalizeAnswer, type ArcadeItem, type DungeonFloor } from "@/lib/arcade-items";
import type { XpResult } from "@/lib/arcade";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

interface DungeonState {
  floors: DungeonFloor[];
  answers: (string | null)[]; // 12 slots, global item index
  hearts: number;
  maxHearts: number;
  done: boolean;
  cleared: number;
  hits: number;
}

const ITEM_COUNT = 12; // 3 floors x 4 items
const FLOOR_SIZE = 4;

function freshHearts(): number {
  return 3;
}

async function loadRun(): Promise<{ id: string; state: DungeonState; isNew: boolean }> {
  const day = dayIndex();
  const id = `day:${day}`;
  const u = await contentUserId().catch(() => "me");
  const row = await db.runState.findUnique({ where: { userId_id: { userId: u, id } } });
  const l = await getLearner();
  if (row) {
    try {
      const state = JSON.parse(row.state) as DungeonState;
      if (state.floors?.length === 3) return { id, state, isNew: false };
    } catch {
      // corrupted row: fall through to rebuild
    }
  }
  const floors = await buildDungeonFloors(day, ladderFor(l.level).band);
  const maxHearts = freshHearts() + (hasPerk(l.perks, "dungeon_heart") ? 1 : 0);
  const state: DungeonState = { floors, answers: Array(ITEM_COUNT).fill(null), hearts: maxHearts, maxHearts, done: false, cleared: 0, hits: 0 };
  await db.runState.upsert({ where: { userId_id: { userId: u, id } }, create: { userId: u, id, day, state: JSON.stringify(state) }, update: { day, state: JSON.stringify(state) } });
  return { id, state, isNew: true };
}

function publicRun(state: DungeonState) {
  return {
    floors: state.floors.map((f) => ({
      n: f.n,
      name: f.name,
      items: f.items.map((i) => ({ id: i.id, kind: i.kind, q: i.q, choices: i.choices, note: i.note, tag: i.tag })),
    })),
    answers: state.answers,
    hearts: state.hearts,
    maxHearts: state.maxHearts,
    done: state.done,
    cleared: state.cleared,
  };
}

export async function GET() {
  const { state, isNew } = await loadRun();
  const u = await contentUserId().catch(() => "me");
  const best = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "dungeon:best" } } });
  return NextResponse.json({ ...publicRun(state), isNew, best: best?.best ?? 0 });
}

interface GradeOut {
  idx: number;
  correct: boolean;
  key?: string;
  hearts: number;
  done: boolean;
  cleared: number;
  perfect: boolean;
  xp?: number;
  capped?: boolean;
  xpResult?: Pick<XpResult, "total" | "leveledUp" | "unlocked">;
}

export async function POST(req: Request) {
  const b = (await req.json()) as { idx?: number; pick?: string };
  const idx = Math.max(0, Math.min(ITEM_COUNT - 1, Math.round(Number(b.idx ?? -1))));
  const { id, state } = await loadRun();
  const out: GradeOut = { idx, correct: false, hearts: state.hearts, done: state.done, cleared: state.cleared, perfect: false };
  if (state.done || state.answers[idx] !== null) return NextResponse.json({ ...out, error: "locked" }, { status: 400 });

  const floor = Math.floor(idx / FLOOR_SIZE);
  const item: ArcadeItem | undefined = state.floors[floor]?.items[idx % FLOOR_SIZE];
  if (!item) return NextResponse.json({ ...out, error: "bad idx" }, { status: 400 });
  const pick = normalizeAnswer(String(b.pick ?? ""));
  const correct = item.accepts.includes(pick);
  state.answers[idx] = String(b.pick ?? "").slice(0, 200);
  out.correct = correct;
  if (correct) state.hits += 1;
  else {
    state.hearts -= 1;
    out.key = item.key;
    await registerMiss();
  }
  out.hearts = state.hearts;

  const floorStart = floor * FLOOR_SIZE;
  const floorDone = state.answers.slice(floorStart, floorStart + FLOOR_SIZE).every((a) => a !== null);
  if (floorDone) state.cleared = Math.max(state.cleared, floor + 1);

  if (state.hearts <= 0 || state.answers.every((a) => a !== null)) {
    state.done = true;
    out.done = true;
    out.cleared = state.cleared;
    out.perfect = state.cleared === 3 && state.hearts === state.maxHearts;
    const table = [0, 40, 90, 160];
    const gain = (table[state.cleared] ?? 0) + (out.perfect ? 50 : 0);
    if (gain > 0) {
      const xp = await awardGameXp("dungeon", gain, { chainHit: state.hits >= 6 });
      out.xp = xp.paid;
      out.capped = xp.capped;
      out.xpResult = { total: xp.total, leveledUp: xp.leveledUp, unlocked: xp.unlocked };
    }
    if (state.cleared >= 1) await progressQuest("dungeon_1", 1);
    await bumpStat("dungeon:best", state.cleared);
    if (out.perfect) await bumpStat("dungeon:perfect", 1);
    await bumpStat("dungeon:runs");
  }
  await db.runState.update({ where: { userId_id: { userId: await contentUserId().catch(() => "me"), id } }, data: { state: JSON.stringify(state) } });
  return NextResponse.json(out);
}
