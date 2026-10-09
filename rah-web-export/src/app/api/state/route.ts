import { NextResponse } from "next/server";
import { getLearner, dueCount, diagnose, buildProfile } from "@/lib/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { deckStats } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const l = await getLearner();
  const today = dayIndex();
  const stat = await db.dailyStat.findUnique({ where: { day: today } });
  const due = await dueCount();
  const diag = await diagnose();
  const chatCount = await db.chatMsg.count();
  const writes = await db.writingSub.count();
  const speaks = await db.speakSession.count();
  const seen = await db.cardState.count();
  const profile = await buildProfile();
  return NextResponse.json({
    learner: {
      level: l.level,
      streak: l.streak,
      dailyGoal: l.dailyGoal,
      retention: l.retention,
      newPerDay: l.newPerDay,
      focusSkill: l.focusSkill,
      placementPhase: l.placementPhase,
    },
    today: stat ?? { reviews: 0, correct: 0, xp: 0, spoken: 0, written: 0, listened: 0 },
    due,
    seen,
    chatCount,
    writes,
    speaks,
    deck: deckStats(),
    diagnosis: diag,
    profile,
  });
}
