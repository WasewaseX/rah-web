import { NextResponse } from "next/server";
import { gradeExamSubmission } from "@/lib/agent/exam";
import { bumpDaily, touchStreak } from "@/lib/server";
import { awardXp, progressQuest, registerMiss } from "@/lib/arcade";

import { aiRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Grade a submitted exam. The exam lives in the DB with its keys; the client
// only ever sends item id -> answer text.
export async function POST(req: Request) {
  // Abuse limit (audit P1-6): AI calls cost real money - 30/min per client IP.
  const rl = aiRateLimit(req);
  if (!rl.ok) return rl.response!;

  const { examId, answers } = await req.json();
  if (!examId || typeof examId !== "string") {
    return NextResponse.json({ error: "examId required" }, { status: 400 });
  }
  const clean: Record<string, string> = {};
  if (answers && typeof answers === "object") {
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (typeof v === "string") clean[k] = v.slice(0, 500);
    }
  }
  const result = await gradeExamSubmission(examId, clean);
  if (!result) return NextResponse.json({ error: "exam not found" }, { status: 404 });
  await bumpDaily("reviews", result.total);
  await bumpDaily("correct", result.correct);
  await awardXp(10 + result.correct * 5, { chainHit: result.correct > 0 });
  if (result.correct < result.total) await registerMiss();
  await touchStreak();
  await progressQuest("exam_1", 1);
  return NextResponse.json(result);
}
