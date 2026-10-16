import { NextResponse } from "next/server";
import { DECK } from "@/lib/content";
import { topMistakes } from "@/lib/mistakes";
import { scoreShadow } from "@/lib/arena-score";
import { awardXp, progressQuest } from "@/lib/arcade";
import { bumpDaily, touchStreak } from "@/lib/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: five shadowing drills. Speakable sentences (5-14 words) from the deck,
// biased toward the learner's active mistake families so the mouth practices
// exactly the constructions the pen keeps missing.
export async function GET() {
  let favored: string[] = [];
  try {
    favored = (await topMistakes(10)).filter((f) => !f.resolvedAt).map((f) => f.tag);
  } catch {
    // fresh db
  }
  const speakable = DECK.filter((c) => {
    const words = c.en.trim().split(/\s+/).length;
    return words >= 4 && words <= 14;
  });
  const hot = speakable.filter((c) => c.traps.some((t) => favored.includes(t)));
  const rest = speakable.filter((c) => !hot.includes(c));
  const picked = [...shuffle(hot).slice(0, 3), ...shuffle(rest)].slice(0, 5);
  return NextResponse.json({
    drills: picked.map((c) => ({ id: c.id, en: c.en, fa: c.fa, tag: c.traps[0] ?? null, note: c.note || null })),
  });
}

// POST: one rep. The browser ASR transcript comes back, the server scores it
// against the target with a word-level diff and pays XP by accuracy.
export async function POST(req: Request) {
  const { target, transcript } = await req.json();
  const t = String(target ?? "").trim();
  const g = String(transcript ?? "").trim();
  if (!t || t.length > 300) return NextResponse.json({ error: "target required" }, { status: 400 });
  if (!g) return NextResponse.json({ error: "transcript required" }, { status: 400 });

  const s = scoreShadow(t, g);
  const xpGain = s.accuracy >= 90 ? 30 : s.accuracy >= 70 ? 20 : 10;
  const xp = await awardXp(xpGain);
  await bumpDaily("spoken");
  await touchStreak();
  await progressQuest("arena_5", 1);

  await db.speakSession.create({
    data: { prompt: `arena:${t.slice(0, 180)}`, transcript: g.slice(0, 500), round: 0, result: JSON.stringify({ arena: s, xpGain }) },
  }).catch(() => undefined); // arena reps are disposable; never block on the log

  return NextResponse.json({
    score: s,
    xpGain,
    totalXp: xp.total,
    leveledUp: xp.leveledUp,
    level: xp.level,
    unlocked: xp.unlocked,
  });
}

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
