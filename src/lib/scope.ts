// Per-user data isolation (audit P0-1, Task 63): the stamp/filter seam for
// learner-content rows. The schema now carries userId on ChatMsg, WritingSub,
// SpeakSession and ReviewLog (default "me"); every write stamps it from the
// authenticated session and every read/delete filters by it, so user A can
// never see user B's chats, essays, transcripts or review history once the
// deployment lock opens.
//
// Single-user era: the deployment lock guarantees at most one User, so the
// resolved id is that user's (or the singleton default for unauthenticated
// legacy surfaces). Isolation therefore DEGRADES to the singleton - it must
// never break a learner flow - while the columns are already load-bearing.

import { getSessionUser, getSessionUserWithRequest } from "@/lib/auth";

/** The legacy singleton key: rows stamped before isolation existed. */
export const SINGLE_USER_ID = "me";

/**
 * The isolation key for the current request. Prefers the request-aware
 * resolver (cookie + embed + header ladder); falls back to the bare cookie
 * resolver; falls back to the singleton on any failure - recovery beats
 * rigidness, and the deployment lock keeps the single-user era safe.
 */
export async function contentUserId(req?: Request): Promise<string> {
  try {
    const u = req ? await getSessionUserWithRequest(req) : await getSessionUser();
    return u?.id ?? SINGLE_USER_ID;
  } catch {
    return SINGLE_USER_ID;
  }
}

/** Prisma where-clause fragment scoping a content table to the current user. */
export async function contentScope(req?: Request): Promise<{ userId: string }> {
  return { userId: await contentUserId(req) };
}
