import { NextResponse } from "next/server";
import { bumpDaily, touchStreak } from "@/lib/server";
import type { DrillOutcome } from "@/lib/tutor/types";

export const dynamic = "force-dynamic";

// POST { drill: { skill, score, total, misses } } -> client already graded the
// drill locally (instant feedback); this records the outcome and pays XP.
export async function POST(req: Request) {
  let body: { drill?: DrillOutcome } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const d = body.drill;
  if (!d || typeof d.score !== "number" || typeof d.total !== "number" || d.total <= 0) {
    return NextResponse.json({ error: "drill outcome required" }, { status: 400 });
  }

  const xp = 10 + d.score * 3;
  await bumpDaily("xp", xp);
  await bumpDaily("reviews", d.score);
  await touchStreak();

  const ratio = d.score / d.total;
  const fa = ratio >= 0.8
    ? "عالی بود؛ همین رگه قوت را فردا با تمرین سخت‌تری ادامه بده."
    : ratio >= 0.5
      ? "نصف راه آمدی؛ اشتباه‌های امروز را یک‌بار بلند بخوان تا ننشیند."
      : "اشکالی ندارد؛ همین سؤال‌های غلط، نقشه‌ی تمرین فردای تو هستند.";

  return NextResponse.json({ ok: true, xp, fa });
}
