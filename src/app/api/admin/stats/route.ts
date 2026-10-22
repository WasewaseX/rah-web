import { db } from "@/lib/db";
import { adminAuthResponse } from "@/lib/admin-token";

export const dynamic = "force-dynamic";

// GET /api/admin/stats - tiny JSON fingerprint of learner state. The deploy
// pipeline diffs this before vs after an update to PROVE the learner's data
// survived the container swap (xp/streak/reviews must never drop). Cheap on
// purpose: verify uses this instead of downloading the whole DB.
// NOTE (Task 67): these counts are deliberately GLOBAL (no userId filter) -
// this endpoint is the admin deploy fingerprint over the whole deployment,
// not a learner surface, and it is guarded by the admin token above.
export async function GET(req: Request) {
  const auth = adminAuthResponse(req);
  if (auth) return auth;

  const learner = await db.learner.findFirst();
  const [
    users,
    reviews,
    achievements,
    cards,
    materials,
    materialCards,
    mistakes,
    exams,
  ] = await Promise.all([
    db.user.count(),
    db.reviewLog.count(),
    db.achievement.count(),
    db.cardState.count(),
    db.material.count(),
    db.materialCard.count(),
    db.mistakeFamily.count(),
    db.exam.count(),
  ]);

  return Response.json(
    {
      xp: learner?.xp ?? -1,
      streak: learner?.streak ?? -1,
      level: learner?.level ?? "?",
      gems: learner?.gems ?? -1,
      users,
      reviews,
      achievements,
      cards,
      materials,
      materialCards,
      mistakes,
      exams,
      servedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
