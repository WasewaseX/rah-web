import { NextResponse } from "next/server";
import { listGoals, createGoal, archiveGoal, planFor } from "@/lib/goals";

export const dynamic = "force-dynamic";

// Goal planner (audit P2, Task 65). GET: the learner's goals (active +
// archived) plus the deterministic capacity plan. POST: create. DELETE ?id:
// archive (never hard delete - the planned-vs-actual record is the point).

export async function GET() {
  const [goals, plan] = await Promise.all([listGoals(), planFor()]);
  return NextResponse.json({ ...goals, plan });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const res = await createGoal({
    title: String(body?.title ?? ""),
    kind: body?.kind === undefined ? undefined : String(body.kind),
    target: body?.target === undefined ? undefined : String(body.target),
    dueDay: body?.dueDay === undefined ? undefined : body.dueDay === null ? null : Number(body.dueDay),
    weeklySessions: body?.weeklySessions === undefined ? undefined : Number(body.weeklySessions),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, goal: res.goal });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await archiveGoal(id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "goal not found" ? 404 : 400 });
  return NextResponse.json({ ok: true });
}
