import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { topMistakes } from "@/lib/mistakes";

export const dynamic = "force-dynamic";

// Mind Reader: the learner sees exactly what the coach remembers - every
// family with its evidence and heal progress, active ones first, healed ones
// kept for history.
export async function GET() {
  const [active, healed] = await Promise.all([topMistakes(40, true), db.mistakeFamily.findMany({ where: { resolvedAt: { not: null } }, orderBy: { updatedAt: "desc" }, take: 40 })]);
  return NextResponse.json({ families: active, healed });
}

// Forgive & forget: one family leaves the coach's memory. Used by the Mind
// Reader surface for false positives or mistakes the learner rejects.
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.mistakeFamily.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
