import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";
import { computeCurriculum } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

// The CEFR curriculum graph, rendered from the learner's REAL evidence.
// Every gate reads the mastery ledger (Wilson bound) and the skill bands -
// the same numbers the Progress war room shows. No AI, fully deterministic.
export async function GET() {
  const u = await contentUserId();
  const [tagRows, skillRows] = await Promise.all([db.tagMastery.findMany({ where: { userId: u } }), db.skillLevel.findMany({ where: { userId: u } })]);
  const result = computeCurriculum(
    tagRows.map((t) => ({ tag: t.tag, ok: t.ok, no: t.no, ewma: t.ewma })),
    skillRows.map((s) => ({ skill: s.skill, score: s.score, samples: s.samples })),
  );
  return NextResponse.json({
    nodes: result.nodes,
    summary: {
      frontier: result.summary.frontier,
      mastered: result.summary.mastered,
      available: result.summary.available,
      locked: result.summary.locked,
      line: result.summary.line,
    },
  });
}
