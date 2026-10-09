import { NextResponse } from "next/server";
import { topMistakes } from "@/lib/mistakes";

export const dynamic = "force-dynamic";

// Learner-visible mistake memory: the recurring production-mistake families
// mined from chat corrections, essays and speaking.
export async function GET() {
  const families = await topMistakes(10);
  return NextResponse.json({ families });
}
