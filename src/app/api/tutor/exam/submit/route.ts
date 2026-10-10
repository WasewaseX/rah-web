import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJson, assessSystem } from "@/lib/ai";
import { getLearner, bumpDaily, touchStreak } from "@/lib/server";
import { gradeExam, fallbackAssessment, type ExamItem } from "@/lib/tutor";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AssessReport {
  band: string;
  verdict: string;
  strengths: string[];
  weaknesses: string[];
  errors: { point: string; picked: string; right: string; fa: string }[];
  prescription: string[];
}

export async function POST(req: Request) {
  const { id, answers, elapsedMs } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const run = await db.examRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.status === "done") {
    // Idempotent: reviewing a finished exam re-serves the stored report.
    return NextResponse.json({ report: run.report ? JSON.parse(run.report) : null, score: run.score, alreadyDone: true });
  }

  const parsed = JSON.parse(run.items) as { title: string; items: ExamItem[] };
  const items = parsed.items;
  const picked: string[] = Array.isArray(answers) ? (answers as string[]) : [];
  const { graded, score, perSkill } = gradeExam(items, picked);
  const elapsed = Math.max(0, Math.min(Number(elapsedMs) || 0, 3_600_000));

  const l = await getLearner();
  const level = l.level === "?" ? "B2" : l.level;

  // Mechanical facts first, then the AI narrative on top of them.
  const wrong = graded.filter((g) => !g.ok);
  const evidence = {
    level,
    kind: run.kind,
    score,
    total: items.length,
    perSkill,
    elapsedMinutes: Math.round(elapsed / 60000),
    wrongItems: wrong.map((g) => ({
      testedPoint: items[g.idx].q,
      skill: items[g.idx].skill,
      picked: g.picked,
      right: g.right,
    })),
  };

  let report: AssessReport;
  try {
    report = await aiJson<AssessReport>(
      assessSystem(level),
      [{ role: "user", content: "Grading blob:\n" + JSON.stringify(evidence) + "\n\nProduce the assessment JSON now." }],
    );
    // Belt and braces: if the AI dropped the wrong-item list, rebuild it mechanically.
    if (!Array.isArray(report.errors) || report.errors.length === 0) {
      report.errors = wrong.map((g) => ({
        point: items[g.idx].q,
        picked: g.picked || "(blank)",
        right: g.right,
        fa: items[g.idx].fa ?? "",
      }));
    }
  } catch {
    report = fallbackAssessment(score, items.length, perSkill);
    report.errors = wrong.map((g) => ({
      point: items[g.idx].q,
      picked: g.picked || "(blank)",
      right: g.right,
      fa: items[g.idx].fa ?? "",
    }));
  }

  await db.examRun.update({
    where: { id },
    data: {
      status: "done",
      answers: JSON.stringify(picked),
      elapsedMs: elapsed,
      score,
      report: JSON.stringify(report),
      finishedAt: new Date(),
    },
  });
  await bumpDaily("xp", 20);
  await touchStreak();

  return NextResponse.json({ report, score, total: items.length, perSkill });
}
