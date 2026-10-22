import { NextResponse } from "next/server";
import { buildBossFight, type BossPhase } from "@/lib/arcade-items";
import { db } from "@/lib/db";
import { awardGameXp, bumpStat, progressQuest, registerMiss } from "@/lib/arcade";
import { bumpDaily, touchStreak } from "@/lib/server";
import { contentUserId } from "@/lib/scope";
import { parseGid, receiptReplay, endReceipt } from "@/lib/sync-receipt";

export const dynamic = "force-dynamic";

const PHASES = 3;
const PER_PHASE = 8;

// GET: the fight. Three phases, eight weakness-biased items each; keys ship
// to the client for instant combat feedback, the server checks the aggregate.
export async function GET() {
  const phases: BossPhase[] = await buildBossFight(PER_PHASE, PHASES);
  const u = await contentUserId().catch(() => "me");
  const wins = await db.gameStat.findUnique({ where: { userId_key: { userId: u, key: "boss:wins" } } });
  return NextResponse.json({ phases, bossWins: wins?.best ?? 0 });
}

interface BossResult {
  won: boolean;
  phaseReached: number; // 1..3
  heartsLeft: number; // 0..3
  correct: number;
  total: number;
}

// POST: settle the fight. XP is clamped to what a real run can earn:
// win = 120 + 20/heartheart (max 180), loss = 25 + 5 per phase reached (max 35).
export async function POST(req: Request) {
  const b = (await req.json()) as Partial<BossResult>;
  const won = b.won === true;
  const phaseReached = Math.min(PHASES, Math.max(1, Math.round(Number(b.phaseReached ?? 1))));
  const heartsLeft = Math.min(3, Math.max(0, Math.round(Number(b.heartsLeft ?? 0))));
  const total = Math.min(PHASES * PER_PHASE, Math.max(0, Math.round(Number(b.total ?? 0))));
  const correct = Math.min(total, Math.max(0, Math.round(Number(b.correct ?? 0))));
  const gid = parseGid((b as { gid?: unknown }).gid);
  const uid = await contentUserId().catch(() => "me");
  const replay = await receiptReplay(gid, uid);
  if (replay) return replay;


  if (won) {
    await bumpStat("boss:wins", 1);
    if (heartsLeft >= 3) await bumpStat("boss:flawless", 1);
  }
  await bumpDaily("reviews", total);
  await bumpDaily("correct", correct);
  const gain = won ? 120 + heartsLeft * 20 : 25 + (phaseReached - 1) * 5;
  const xp = await awardGameXp("boss", gain, { chainHit: won });
  if (!won) await registerMiss();
  await touchStreak();
  await progressQuest("boss_phase", phaseReached);
  if (won) await progressQuest("boss_win", 1);

  const payload = {
    xpGain: xp.paid,
    capped: xp.capped,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
  };
  await endReceipt(gid, uid, payload);
  return NextResponse.json(payload);
}
