import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET (no id): the graded-exam shelf for the Replay Theater.
// GET (?id=): one exam's full replay bundle - items WITH keys, the spec, and
// the stored per-item verdicts, so the client can step through the exam
// turn by turn exactly as it happened.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const exam = await db.exam.findUnique({ where: { id } });
    if (!exam || exam.status !== "graded") return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      spec: JSON.parse(exam.spec || "{}"),
      items: JSON.parse(exam.items || "[]"),
      result: JSON.parse(exam.result || "null"),
      createdAt: exam.createdAt,
    });
  }
  const rows = await db.exam.findMany({ where: { status: "graded" }, orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({
    exams: rows.map((r) => {
      const res = JSON.parse(r.result || "{}") as { total?: number; correct?: number };
      return { id: r.id, title: r.title, createdAt: r.createdAt, total: res.total ?? null, correct: res.correct ?? null };
    }),
  });
}
