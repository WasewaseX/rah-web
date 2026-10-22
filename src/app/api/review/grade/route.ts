import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentUserId } from "@/lib/scope";
import { dayIndex, review, preview, defaultState, type FsrsState } from "@/lib/fsrs";
import { getLearner, bumpDaily, touchStreak } from "@/lib/server";
import { awardXp, progressQuest, registerMiss } from "@/lib/arcade";

export const dynamic = "force-dynamic";

const ACK_TTL_DAYS = 7;

export async function POST(req: Request) {
  const body = await req.json();
  const cardId = String(body.cardId ?? "");
  const grade = Math.min(4, Math.max(1, Number(body.grade ?? 3)));
  const dir = String(body.dir ?? "");
  // Offline replay idempotency (Task 68): the client stamps every grade with
  // a uuid. A flush retry (or a second device flushing the same outbox)
  // returns the ORIGINAL response instead of re-grading - no double XP, no
  // double quest progress, no schedule double-step.
  const gid = typeof body.gid === "string" && body.gid.length >= 8 && body.gid.length <= 64 ? body.gid : "";
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const u = await contentUserId(req);

  if (gid) {
    const ack = await db.gradeAck.findUnique({ where: { gid } });
    if (ack && ack.userId === u) {
      try {
        const stored = JSON.parse(ack.response) as Record<string, unknown>;
        return NextResponse.json({ ...stored, replayed: true });
      } catch {
        // corrupted receipt: fall through and grade normally (the log row
        // from the first attempt still exists; this is the rare torn row)
      }
    }
  }

  const l = await getLearner();
  const today = dayIndex();
  const row = await db.cardState.findUnique({ where: { userId_cardId: { userId: u, cardId } } });
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
    where: { userId_cardId: { userId: u, cardId } },
    create: {
      userId: u,
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

  await db.reviewLog.create({ data: { cardId, grade, ivl: out.ivl, day: today, userId: u } });
  await bumpDaily("reviews");
  await awardXp(grade >= 3 ? 10 : 5, { chainHit: grade >= 3, perkXp: "review" });
  if (grade < 2) await registerMiss();
  if (grade >= 2) await bumpDaily("correct");
  await touchStreak();
  await progressQuest("reviews_20", 1);
  await progressQuest("reviews_35", 1);
  if (grade >= 3) await progressQuest("correct_15", 1);

  const next = await db.cardState.findUnique({ where: { userId_cardId: { userId: u, cardId } } });
  const payload = {
    ivl: out.ivl,
    due: out.due,
    previews: preview(out.fsrs, today, l.retention),
    state: next,
  };

  if (gid) {
    // Store the receipt (best-effort: a failed receipt write must not fail a
    // live grade) and expire stale ones - receipts only need to outlive the
    // reconnect window, not the learner.
    await db.gradeAck
      .create({ data: { gid, userId: u, response: JSON.stringify(payload) } })
      .catch(() => undefined);
    const cutoff = new Date(Date.now() - ACK_TTL_DAYS * 86_400_000);
    await db.gradeAck.deleteMany({ where: { userId: u, at: { lt: cutoff } } }).catch(() => undefined);
  }

  return NextResponse.json(payload);
}
