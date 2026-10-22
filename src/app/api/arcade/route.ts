import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { ensureQuests, getGameView, getRivalView } from "@/lib/arcade";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// The arcade state: quests for today, the rival race, the level ladder,
// trophies and game records. One cheap call the shell polls alongside /api/state.
export async function GET() {
  await ensureQuests();
  const u = await contentUserId().catch(() => "me");
  const [game, rival, quests] = await Promise.all([
    getGameView(),
    getRivalView(),
    db.quest.findMany({ where: { userId: u, day: dayIndex() }, orderBy: { id: "asc" } }),
  ]);
  return NextResponse.json({ game, rival, quests });
}
