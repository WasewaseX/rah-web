import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner } from "@/lib/server";

export async function GET() {
  const learner = await getLearner();
  const checkpoints = await db.checkpoint.findMany({
    where: { learnerId: learner.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ checkpoints });
}
