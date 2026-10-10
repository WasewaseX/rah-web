import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfile, bumpDaily, touchStreak } from "@/lib/server";
import { gradeExam } from "@/lib/skills/exam";
import type { Exam, ExamResult } from "@/lib/skills/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Grade a submitted exam. The steps ride along in the response so the UI can
// show the checking sequence inside the exam card.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const exam = body?.exam as Exam | undefined;
  const answers = (body?.answers ?? {}) as Record<string, string>;
  if (!exam?.questions?.length) {
    return NextResponse.json({ error: "exam required" }, { status: 400 });
  }

  // count consistency is structural: the exam graded is exactly the exam sent
  const steps: { label: string; state: "run" | "done"; detail?: string }[] = [];
  const profile = await buildProfile();
  const result: ExamResult = await gradeExam(exam, answers, {
    profile,
    emit: (s) => steps.push(s),
  });

  await db.chatMsg.create({
    data: { role: "coach", content: JSON.stringify({ kind: "examResult", result }) },
  });
  await bumpDaily("correct", result.score);
  await bumpDaily("xp", 10 + result.score * 2);
  await touchStreak();

  return NextResponse.json({ result, steps });
}
