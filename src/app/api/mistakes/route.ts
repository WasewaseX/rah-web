import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { topMistakes, correctFamily, forgetFamily } from "@/lib/mistakes";
import { contentUserId } from "@/lib/scope";

export const dynamic = "force-dynamic";

// Mind Reader: the learner sees exactly what the coach remembers - every
// family with its evidence and heal progress, active ones first, healed ones
// kept for history. Scoped to the caller (Task 65 isolation completion).
export async function GET(req: Request) {
  const u = await contentUserId(req);
  const [active, healed] = await Promise.all([topMistakes(40, true, u), db.mistakeFamily.findMany({ where: { userId: u, resolvedAt: { not: null } }, orderBy: { updatedAt: "desc" }, take: 40 })]);
  return NextResponse.json({ families: active, healed });
}

// Learner-memory corrections (audit P2, Task 65): the learner fixes what the
// memory quotes - edit the label or the wrong->right evidence pair. The tag
// stays (it is the taxonomy key the tutor, examiner and mastery ledger aim
// with); editedAt marks the row learner-authored so nothing presents
// learner-edited text as AI-mined.
export async function POST(req: Request) {
  const u = await contentUserId(req);
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const patch: { label?: string; evidence?: string } = {};
  if (typeof body?.label === "string") patch.label = body.label;
  if (typeof body?.evidence === "string") patch.evidence = body.evidence;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to correct - send label and/or evidence" }, { status: 400 });
  const res = await correctFamily(id, patch, u);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "family not found in your memory" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}

// Forgive & forget: one family leaves the coach's memory AND a tombstone
// records the exact rejected evidence pair - the same wrong->right pair will
// not re-aggregate (a rejected false positive must not resurrect every
// session), while genuinely new evidence under the same tag still reopens the
// family. Scoped to the caller; cross-user ids 404.
export async function DELETE(req: Request) {
  const u = await contentUserId(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await forgetFamily(id, u);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "family not found in your memory" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
