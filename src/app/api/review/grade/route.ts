import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex, review, preview, defaultState, type FsrsState } from "@/lib/fsrs";
import { getLearner, bumpDaily, touchStreak } from "@/lib/server";
import { awardXp, progressQuest, registerMiss } from "@/lib/arcade";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const cardId = String(body.cardId ?? "");
  const grade = Math.min(4, Math.max(1, Number(body.grade ?? 3)));
  const dir = String(body.dir ?? "");
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const l = await getLearner();
  const today = dayIndex();
  const row = await db.cardState.findUnique({ where: { cardId } });
  const st: FsrsState = row
    ? {
        s: row.s,
        d: row.d,
        due: row.due,
        last: row.last,
        lapses: row.lapses,
        reps: row.reps,
        state: row.state,
        lastivl: row.lastivl,
      }
    : defaultState();

  const out = review(st, grade, today, l.retention);

  await db.cardState.upsert({
    where: { cardId },
    create: {
      cardId,
      s: out.fsrs.s,
      d: out.fsrs.d,
      due: out.fsrs.due,
      last: out.fsrs.last,
      lapses: out.fsrs.lapses,
      reps: out.fsrs.reps,
      state: out.fsrs.state,
      lastivl: out.fsrs.lastivl,
      dir,
    },
    update: {
      s: out.fsrs.s,
      d: out.fsrs.d,
      due: out.fsrs.due,
      last: out.fsrs.last,
      lapses: out.fsrs.lapses,
      reps: out.fsrs.reps,
      state: out.fsrs.state,
      lastivl: out.fsrs.lastivl,
      dir,
    },
  });

  await db.reviewLog.create({ data: { cardId, grade, ivl: out.ivl, day: today } });
  await bumpDaily("reviews");
  await awardXp(grade >= 3 ? 10 : 5, { chainHit: grade >= 3, perkXp: "review" });
  if (grade < 2) await registerMiss();
  if (grade >= 2) await bumpDaily("correct");
  await touchStreak();
  await progressQuest("reviews_20", 1);
  await progressQuest("reviews_35", 1);
  if (grade >= 3) await progressQuest("correct_15", 1);

  const next = await db.cardState.findUnique({ where: { cardId } });
  return NextResponse.json({
    ivl: out.ivl,
    due: out.due,
    previews: preview(out.fsrs, today, l.retention),
    state: next,
  });
}
