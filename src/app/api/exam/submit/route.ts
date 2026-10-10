import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildProfile, bumpDaily, touchStreak, getLearner } from "@/lib/server";
import { aiJson } from "@/lib/ai";
import { quickGrade, examinerSystem, examinerPayload, parseExaminer, finalize, mechanicalReport, setPointsMap } from "@/lib/tutor/grading";
import type { CoachEnvelope, Exam, ExamAnswers, ExamItemResult } from "@/lib/tutor/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST { runId, answers }  -> grade the exam with the two-pass examiner
// (mechanical fuzzy pass + one deep-thinking meaning judgment), assess,
// persist, move the level when earned, pay XP.
export async function POST(req: Request) {
  let body: { runId?: number; answers?: ExamAnswers } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const runId = Number(body.runId);
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });

  const run = await db.examRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "exam run not found" }, { status: 404 });
  if (run.percent >= 0) return NextResponse.json({ error: "exam already submitted" }, { status: 409 });

  const exam = JSON.parse(run.exam) as Omit<Exam, "id">;
  const profile = await buildProfile();
  setPointsMap(exam.questions);

  // Pass 1: deterministic (exact + acceptable list + typo tolerance).
  const quick = quickGrade(exam, body.answers ?? {});

  // Pass 2: the examiner judges MEANING on top of it and writes the report.
  // One deep-thinking call; every claim is anchored in the real answers.
  let items: ExamItemResult[] = quick.items;
  let score = quick.score, total = quick.total, percent = quick.percent;
  let report = mechanicalReport(exam, quick);
  try {
    const raw = await aiJson<{ items: unknown[]; report: unknown }>(
      examinerSystem(exam.level, JSON.stringify(profile)),
      [{ role: "user", content: examinerPayload(exam, body.answers ?? {}, quick) }],
      undefined,
      { thinking: true, attempts: 3 },
    );
    const out = parseExaminer(raw, quick);
    if (out) {
      const fin = finalize(quick, out);
      items = fin.items;
      score = fin.score;
      total = fin.total;
      percent = fin.percent;
      report = out.report;
    }
  } catch {
    // examiner unreachable: quick grade + mechanical report stand
  }

  const writeItem = items.find((i) => i.type === "write");
  const result: CoachEnvelope["result"] = {
    title: exam.title,
    score,
    total,
    percent,
    band: report.band,
    items,
    strengths: (report.strengths ?? []).slice(0, 3),
    weaknesses: (report.weaknesses ?? []).slice(0, 3),
    leaks: (report.leaks ?? []).slice(0, 3),
    next_action: report.next_action ?? "",
    write_eval: report.write_eval ?? (writeItem ? { score: 0, note: "The examiner could not reach the writing grader; compare with the model answer.", fa: "مقایسه کن با پاسخ نمونه." } : null),
    dimensions: report.dimensions ?? null,
    runId,
  };

  await db.examRun.update({
    where: { id: runId },
    data: { score, total, percent, band: report.band, result: JSON.stringify(result) },
  });

  const accepted = items.filter((i) => i.verdict === "typo" || (i.verdict === "accepted" && i.expected && i.given && i.given.toLowerCase() !== i.expected.toLowerCase())).length;
  const envelope: CoachEnvelope = {
    reply: `Graded: ${score}/${total} (${percent}%). Band: ${report.band}.${accepted > 0 ? ` ${accepted} answer${accepted > 1 ? "s" : ""} accepted in your own wording.` : ""}`,
    kind: "result",
    corrections: [],
    fa_note: "نتیجه را مرور کن؛ بعدش مشخص است.",
    result,
  };
  await db.chatMsg.create({ data: { role: "coach", content: JSON.stringify(envelope) } });

  await bumpDaily("xp", 40);
  await bumpDaily("reviews", 1);
  await touchStreak();
  await maybeMoveLevel(exam.spec, percent);

  return NextResponse.json(envelope);
}

// Level moves: earned by evidence, never guesses. A strong pass on the full
// mock promotes; a partial pass on the first-ever exam anchors an unmeasured
// level. Downgrades never happen automatically.
async function maybeMoveLevel(spec: string, percent: number) {
  const l = await getLearner();
  if (spec === "mixed" && percent >= 85 && l.level !== "C1") {
    await db.learner.update({ where: { id: "me" }, data: { level: "C1" } });
    return;
  }
  if (spec === "mixed" && percent >= 60 && l.level === "?") {
    await db.learner.update({ where: { id: "me" }, data: { level: "B2" } });
  }
}
