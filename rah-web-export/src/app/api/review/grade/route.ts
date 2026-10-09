import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dayIndex, review, preview, defaultState, type FsrsState } from "@/lib/fsrs";
import { getLearner, bumpDaily, touchStreak } from "@/lib/server";

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
  await bumpDaily("xp", grade >= 3 ? 10 : 5);
  if (grade >= 2) await bumpDaily("correct");
  await touchStreak();

  const next = await db.cardState.findUnique({ where: { cardId } });
  return NextResponse.json({
    ivl: out.ivl,
    due: out.due,
    previews: preview(out.fsrs, today, l.retention),
    state: next,
  });
}
