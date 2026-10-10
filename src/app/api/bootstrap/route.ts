import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLearner, getSettings, today } from "@/lib/server";
import { profileView } from "@/lib/ai";
import { toFsrs } from "@/lib/fsrs";
import { DECK, CARD_BY_ID } from "@/lib/content";

// The daily protocol, bent toward the learner's weakest strand.
export function planFor(diagnosis: Record<string, number>): { strand: string; label: string; minutes: number; view: string; note: string }[] {
  const base: { strand: string; label: string; minutes: number; view: string; note: string }[] = [
    { strand: "review", label: "Spaced retrieval", minutes: 20, view: "review", note: "Pull the due cards back from memory, then check" },
    { strand: "listening", label: "Listening + decoding", minutes: 25, view: "listening", note: "Blind listen, diagnose exactly what you missed" },
    { strand: "reading", label: "Extensive reading", minutes: 25, view: "reading", note: "Read interesting material without stopping constantly" },
    { strand: "speaking", label: "Speaking, same task again", minutes: 20, view: "speaking", note: "Record, find one weakness, repair, repeat" },
    { strand: "writing", label: "Writing with repair", minutes: 10, view: "writing", note: "Short response, then fix one recurring error" },
    { strand: "sound", label: "Pronunciation perception", minutes: 10, view: "sound", note: "Hear, identify, distinguish, reproduce" },
  ];
  const weakest = Object.entries(diagnosis).sort((a, b) => a[1] - b[1])[0];
  if (!weakest) return base;
  return base.map((b) => {
    if (b.strand === weakest[0]) return { ...b, minutes: Math.round(b.minutes * 1.5) };
    if (b.strand === "reading") return { ...b, minutes: Math.max(10, b.minutes - 10) };
    return b;
  });
}

const NEW_LIMIT = 12;

export async function GET() {
  const learner = await getLearner();
  const settings = await getSettings();
  const day = today();

  const states = await db.cardState.findMany({ where: { learnerId: learner.id } });
  const userCards = await db.userCard.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" } });

  let due = 0;
  const seenIds = new Set(states.map((s) => s.cardId));
  for (const s of states) {
    const st = toFsrs(s);
    if (st.state !== "new" && st.due <= day) due += 1;
  }
  const knownUserCards = userCards.filter((c) => !seenIds.has("u_" + c.id)).length;
  const fresh = DECK.length - (states.length - knownUserCards) + knownUserCards;

  const sessions = await db.sessionLog.findMany({ where: { learnerId: learner.id, day } });
  const minutesByStrand: Record<string, number> = {};
  for (const s of sessions) minutesByStrand[s.strand] = (minutesByStrand[s.strand] ?? 0) + s.minutes;

  const diagnosis = JSON.parse(learner.diagnosis || "{}");
  const plan = planFor(diagnosis);
  const totalPlanned = plan.reduce((a, b) => a + b.minutes, 0);
  const donePlanned = plan.reduce((a, b) => a + Math.min(b.minutes, minutesByStrand[b.strand] ?? 0), 0);

  const placement = await db.placementResult.findFirst({
    where: { learnerId: learner.id },
    orderBy: { createdAt: "desc" },
  });

  const grammarDone = await db.grammarDone.findMany({ where: { learnerId: learner.id } });
  const checkpoints = await db.checkpoint.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    learner: {
      name: learner.name,
      level: learner.level,
      streak: learner.streak,
      bestStreak: learner.bestStreak,
      onboarded: learner.onboarded,
      diagnosis,
      xp: learner.xp,
    },
    counts: { due, fresh },
    plan,
    protocol: { totalPlanned, donePlanned, minutesByStrand },
    placement: placement ? { level: placement.level, strands: JSON.parse(placement.strands), day: placement.day } : null,
    ai: profileView(settings),
    stats: {
      grammarDone: grammarDone.length,
      grammarTotal: 10,
      checkpointCount: checkpoints.length,
    },
    newToday: Math.min(fresh, NEW_LIMIT),
  });
}
