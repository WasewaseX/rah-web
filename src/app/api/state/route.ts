import { NextResponse } from "next/server";
import { getLearner, dueCount, diagnose, buildProfile } from "@/lib/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { deckStats } from "@/lib/content";
import { ensureQuests, getGameView, getRivalView, getLeagueView, getChain } from "@/lib/arcade";
import { getMasteryView } from "@/lib/mastery";
import { nextBestActions } from "@/lib/next-best";
import { shopView } from "@/lib/shop";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const l = await getLearner();
  const today = dayIndex();
  const u = await contentUserId().catch(() => "me");
  const stat = await db.dailyStat.findUnique({ where: { userId_day: { userId: u, day: today } } });
  const due = await dueCount();
  const diag = await diagnose();
  const chatCount = await db.chatMsg.count({ where: { userId: u } });
  const writes = await db.writingSub.count({ where: { userId: u } });
  const speaks = await db.speakSession.count({ where: { userId: u } });
  const seen = await db.cardState.count({ where: { userId: u } });
  const profile = await buildProfile();
  const theme = l.theme ? JSON.parse(l.theme) : null;
  await ensureQuests();
  const [game, rival, quests, league, chain, mastery, nextBest, shop] = await Promise.all([getGameView(), getRivalView(), db.quest.findMany({ where: { userId: u, day: today }, orderBy: { id: "asc" } }), getLeagueView(), getChain(), getMasteryView(), nextBestActions(), Promise.resolve(shopView(l.gems, l.freezes, l.boostUntil))]);
  return NextResponse.json({
    learner: {
      level: l.level,
      streak: l.streak,
      dailyGoal: l.dailyGoal,
      retention: l.retention,
      newPerDay: l.newPerDay,
      focusSkill: l.focusSkill,
      placementPhase: l.placementPhase,
      freezes: l.freezes,
      gems: l.gems,
      boostUntil: l.boostUntil,
      boostActive: shop.boostActive,
    },
    theme,
    today: stat ?? { reviews: 0, correct: 0, xp: 0, spoken: 0, written: 0, listened: 0 },
    due,
    seen,
    chatCount,
    writes,
    speaks,
    deck: deckStats(),
    diagnosis: diag,
    profile,
    game,
    rival,
    quests,
    league,
    chain,
    mastery,
    nextBest,
    shop,
  });
}
