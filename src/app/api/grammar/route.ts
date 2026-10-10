import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";

export async function GET() {
  const learner = await getLearner();
  const rows = await db.grammarDone.findMany({ where: { learnerId: learner.id } });
  return NextResponse.json({ done: rows.map((r) => r.lessonId) });
}
