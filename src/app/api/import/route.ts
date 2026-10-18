import { NextResponse } from "next/server";
import { planImport, commitImport, type ImportPlan } from "@/lib/portable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// P5: validated restore. POST { bundle, dryRun? }.
//  - dryRun: validate + report per-table counts, write NOTHING.
//  - commit: one transaction, delete-then-create over the fixed table list;
//    importing the same bundle twice lands on the same state (idempotent),
//    and a post-import export re-hashes identically.
// A wrong hash or a missing table is refused BEFORE any write.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { bundle?: unknown; dryRun?: boolean } | null;
  if (!body || body.bundle === undefined) {
    return NextResponse.json({ error: "bundle required" }, { status: 400 });
  }
  const plan: ImportPlan = planImport(body.bundle);
  if (!plan.valid) {
    return NextResponse.json({ error: plan.reason }, { status: 422 });
  }
  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, counts: plan.counts, hash: plan.hash });
  }
  try {
    await commitImport((body.bundle as { tables: Record<string, Record<string, unknown>[]> }).tables);
  } catch (e) {
    return NextResponse.json(
      { error: `Import failed inside the transaction, nothing was changed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, counts: plan.counts, hash: plan.hash });
}
