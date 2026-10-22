// DELETE /api/account - real account deletion (audit P1-9).
//
// Auth-gated. Removes the caller's account-scoped rows (User cascade-deletes
// its Sessions; login codes go by email) and, when the deleted account was
// the LAST user of the deployment (the normal single-user case), also wipes
// the full learner state - every learning table plus the coach workspace
// files - because in a claimed deployment the account and the learner are the
// same person. If other accounts remain (open-registration dev mode), the
// shared learner state stays and the response says so honestly.
//
// SHAPE: { ok, removed: { account, learnerState, workspaceFiles }, notice? }
// After a full wipe the deployment is unclaimed again (zero users => the
// deployment lock opens for the next registration).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rm } from "fs/promises";
import { db } from "@/lib/db";
import { getSessionUserWithRequest, destroySession, SESSION_COOKIE } from "@/lib/auth";
import { WORKSPACE_ROOT } from "@/lib/coach-agent/tools";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const user = await getSessionUserWithRequest(req);
  if (!user) return NextResponse.json({ error: "Sign in to delete your account." }, { status: 401 });

  const email = user.email;

  // Account-scoped rows first (User cascade removes its Sessions).
  await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
  await db.loginCode.deleteMany({ where: { email } });

  const removed: { account: boolean; learnerState: boolean; workspaceFiles: boolean } = {
    account: true,
    learnerState: false,
    workspaceFiles: false,
  };
  let notice: string | undefined;

  // Per-user learner rows: removed in BOTH branches (Task 67). Deleting your
  // account must never leave your FSRS queue, quests, trophies, runs, bands,
  // placement history, materials or memory rows behind for anyone else - the
  // tables are (userId, ...) keyed now, so these deletes are exact.
  const u = user.id;
  await db.cardState.deleteMany({ where: { userId: u } });
  await db.reviewLog.deleteMany({ where: { userId: u } });
  await db.placement.deleteMany({ where: { userId: u } });
  await db.chatMsg.deleteMany({ where: { userId: u } });
  await db.writingSub.deleteMany({ where: { userId: u } });
  await db.speakSession.deleteMany({ where: { userId: u } });
  await db.dailyStat.deleteMany({ where: { userId: u } });
  await db.goal.deleteMany({ where: { userId: u } });
  await db.skillLevel.deleteMany({ where: { userId: u } });
  await db.achievement.deleteMany({ where: { userId: u } });
  await db.gameStat.deleteMany({ where: { userId: u } });
  await db.quest.deleteMany({ where: { userId: u } });
  await db.rival.deleteMany({ where: { userId: u } });
  await db.league.deleteMany({ where: { userId: u } });
  await db.runState.deleteMany({ where: { userId: u } });
  await db.mistakeFamily.deleteMany({ where: { userId: u } });
  await db.mistakeForgiven.deleteMany({ where: { userId: u } });
  await db.tagMastery.deleteMany({ where: { userId: u } });
  // The caller's imported materials (pasted texts are learner content) and
  // their cards. Cards go first: they are referenced by materialId.
  const myMaterials = await db.material.findMany({ where: { userId: u }, select: { id: true } });
  await db.materialCard.deleteMany({ where: { materialId: { in: myMaterials.map((m) => m.id) } } });
  await db.material.deleteMany({ where: { userId: u } });

  const remainingUsers = await db.user.count();
  if (remainingUsers === 0) {
    // Last account out: also wipe the SHARED singleton state (no owner left).
    await db.quizItem.deleteMany();
    await db.exam.deleteMany();
    await db.briefing.deleteMany();
    await db.contentFlag.deleteMany();
    await db.learner.deleteMany();
    removed.learnerState = true;

    // The coach workspace files are learner deliverables - they go too.
    await rm(WORKSPACE_ROOT, { recursive: true, force: true }).then(
      () => {
        removed.workspaceFiles = true;
      },
      () => undefined,
    );
  } else {
    notice =
      "Your learner rows were deleted; shared deployment state (the singleton learner profile) was kept because other accounts remain. Ask the owner about a full wipe.";
  }

  // Kill the caller's auth artifacts: the session is already gone with the
  // User cascade; make sure the cookie never resolves again either way.
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  jar.delete(SESSION_COOKIE);

  return NextResponse.json({ ok: true, removed, notice });
}
