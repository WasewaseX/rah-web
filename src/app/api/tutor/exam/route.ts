import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, examSystem } from "@/lib/ai";
import { getLearner } from "@/lib/server";
import type { ExamItem } from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const LENGTHS: Record<string, number> = { quick: 8, standard: 12, full: 18 };
const KINDS = new Set(["vocabulary", "grammar", "reading", "use", "mock"]);

// Create a fresh exam. Answers stay server-side; the runner never sees them.
export async function POST(req: Request) {
  const { kind, length } = await req.json().catch(() => ({}));
  const k = KINDS.has(kind) ? kind : "mock";
  const count = LENGTHS[length] ?? 12;

  // Reading passages cannot carry 18 items in one coherent call.
  const n = k === "reading" ? Math.min(count, 10) : count;
  const l = await getLearner();
  const level = l.level === "?" ? "B2" : l.level;

  let exam: { title?: string; passage?: string; items?: ExamItem[] };
  try {
    exam = await aiJson(
      examSystem(k, level, n),
      [{ role: "user", content: `Write the ${k} exam with ${n} items at ${level}. Output the JSON now.` }],
    );
  } catch (e) {
    return NextResponse.json({ error: `Exam generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  const items = (exam.items ?? []).filter((it) => it && it.q && it.a);
  if (items.length < 4) {
    return NextResponse.json({ error: "Exam came back too thin, try again" }, { status: 502 });
  }

  const row = await db.examRun.create({
    data: { kind: k, length: items.length, items: JSON.stringify({ title: exam.title ?? "Exam", passage: exam.passage ?? "", items }) },
  });

  return NextResponse.json({
    id: row.id,
    title: exam.title ?? "Exam",
    passage: exam.passage ?? "",
    items: items.map((it) => ({ type: it.type, skill: it.skill, q: it.q, choices: it.choices ?? [] })),
  });
}

// GET: no id -> history list; id -> one exam (answers included only when done).
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    const rows = await db.examRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return NextResponse.json({
      history: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        length: r.length,
        status: r.status,
        score: r.score,
        band: r.report ? safe(r.report).band ?? null : null,
        at: r.finishedAt ?? r.createdAt,
      })),
    });
  }

  const r = await db.examRun.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  const parsed = JSON.parse(r.items) as { title: string; passage: string; items: ExamItem[] };

  if (r.status !== "done") {
    return NextResponse.json({
      id: r.id,
      title: parsed.title,
      passage: parsed.passage,
      kind: r.kind,
      status: r.status,
      items: parsed.items.map((it) => ({ type: it.type, skill: it.skill, q: it.q, choices: it.choices ?? [] })),
      answers: safeArray(r.answers),
    });
  }

  const report = r.report ? safe(r.report) : null;
  return NextResponse.json({
    id: r.id,
    title: parsed.title,
    passage: parsed.passage,
    kind: r.kind,
    status: r.status,
    score: r.score,
    elapsedMs: r.elapsedMs,
    items: parsed.items, // with answers: review mode
    learnerAnswers: safeArray(r.answers),
    report,
  });
}

// DELETE clears one exam from history.
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) await db.examRun.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}

function safe(s: string): { band?: string } {
  try {
    return JSON.parse(s) as { band?: string };
  } catch {
    return {};
  }
}

function safeArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}
