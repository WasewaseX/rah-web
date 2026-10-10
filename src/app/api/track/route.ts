import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner, today, touchStreak } from "@/lib/server";

// One endpoint for all deliberate-practice tracking:
// listening rounds, speaking attempts, sound quizzes, grammar lessons,
// reading minutes, checkpoint saves.
const VALID = new Set(["review", "listening", "reading", "speaking", "writing", "sound"]);

export async function POST(req: Request) {
  const body = await req.json();
  const kind: string = body.kind ?? "";
  const learner = await getLearner();
  const day = today();

  switch (kind) {
    case "listening": {
      await db.listeningLog.create({
        data: {
          learnerId: learner.id,
          passageId: String(body.passageId ?? ""),
          round: Number(body.round ?? 0),
          missType: String(body.missType ?? ""),
          detail: String(body.detail ?? "").slice(0, 500),
        },
      });
      break;
    }
    case "speaking": {
      const promptId = String(body.promptId ?? "");
      const prev = await db.speakingAttempt.count({ where: { learnerId: learner.id, promptId } });
      await db.speakingAttempt.create({
        data: {
          learnerId: learner.id,
          promptId,
          attemptNo: prev + 1,
          seconds: Number(body.seconds ?? 0),
          selfEval: JSON.stringify(body.selfEval ?? {}),
        },
      });
      break;
    }
    case "sound": {
      await db.soundLog.create({
        data: {
          learnerId: learner.id,
          pairId: String(body.pairId ?? ""),
          focus: String(body.focus ?? ""),
          correct: !!body.correct,
        },
      });
      break;
    }
    case "grammar": {
      await db.grammarDone.upsert({
        where: { learnerId_lessonId: { learnerId: learner.id, lessonId: String(body.lessonId ?? "") } },
        create: { learnerId: learner.id, lessonId: String(body.lessonId ?? "") },
        update: {},
      });
      break;
    }
    case "checkpoint": {
      await db.checkpoint.create({
        data: {
          learnerId: learner.id,
          listeningPct: Math.max(0, Math.min(100, Number(body.listeningPct ?? 0))),
          readingScore: Math.max(0, Math.min(100, Number(body.readingScore ?? 0))),
          writingText: String(body.writingText ?? "").slice(0, 6000),
          speakingNotes: String(body.speakingNotes ?? "").slice(0, 2000),
          day,
        },
      });
      break;
    }
    case "reading": {
      // minutes logged below, meta holds the reading id
      break;
    }
    default: {
      if (!VALID.has(kind)) {
        return NextResponse.json({ error: "unknown kind" }, { status: 400 });
      }
    }
  }

  const minutes = Math.max(0, Math.min(180, Number(body.minutes ?? 0)));
  if (minutes > 0 && VALID.has(kind)) {
    await db.sessionLog.create({
      data: { learnerId: learner.id, day, strand: kind, minutes, meta: JSON.stringify(body.meta ?? {}) },
    });
    await db.learner.update({ where: { id: learner.id }, data: { xp: { increment: minutes } } });
    await touchStreak(learner.id);
  }

  return NextResponse.json({ ok: true });
}
