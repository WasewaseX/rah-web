import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gradeExam, type ExamSpec } from "@/lib/exam";
import { bumpDaily } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Grade an exam the learner answered inline in the coach.
export async function POST(req: Request) {
  const body = await req.json();
  const examId = String(body.examId ?? "");
  const answers = (body.answers ?? {}) as Record<string, string>;
  if (!examId) return NextResponse.json({ error: "examId required" }, { status: 400 });

  const row = await db.exam.findUnique({ where: { id: examId } });
  if (!row) return NextResponse.json({ error: "exam not found" }, { status: 404 });

  // Idempotent: a graded exam returns its stored result.
  if (row.status === "graded" && row.result) {
    return NextResponse.json(JSON.parse(row.result));
  }

  const spec = JSON.parse(row.spec) as ExamSpec;
  const result = await gradeExam(spec, answers);

  await db.exam.update({
    where: { id: examId },
    data: { status: "graded", result: JSON.stringify(result), gradedAt: new Date() },
  });
  await bumpDaily("correct", result.correct);
  await bumpDaily("reviews", result.answered);
  await bumpDaily("xp", result.correct * 5);

  return NextResponse.json(result);
}
