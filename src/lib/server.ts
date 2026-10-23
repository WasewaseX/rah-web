// Shared server-side helpers: learner state, streak, live profile, diagnosis.

import { db } from "@/lib/db";
import { DECK, cardById } from "@/lib/content";
import { dayIndex } from "@/lib/fsrs";
import { topMistakes } from "@/lib/mistakes";
import { contentUserId } from "@/lib/scope";
import type { ProfileJson } from "@/lib/ai";

export async function getLearner() {
  let l = await db.learner.findUnique({ where: { id: "me" } });
  if (!l) l = await db.learner.create({ data: { id: "me" } });
  return l;
}

export async function bumpDaily(field: "reviews" | "correct" | "xp" | "spoken" | "written" | "listened", inc = 1, userId?: string) {
  const u = userId ?? (await contentUserId().catch(() => "me"));
  const day = dayIndex();
  await db.dailyStat.upsert({
    where: { userId_day: { userId: u, day } },
    create: { userId: u, day, [field]: inc },
    update: { [field]: { increment: inc } },
  });
}

// Streak forge: consecutive days extend the chain, a single missed day is
// absorbed by a freeze if one is banked (that is what freezes are for), and
// every full week mints one more freeze (banked max 2). A two-day gap with
// no freeze, or any longer gap, resets the chain - honest again.
export async function touchStreak() {
  const l = await getLearner();
  const today = dayIndex();
  if (l.lastActiveDay === today) return l;
  const gap = today - l.lastActiveDay;
  let streak: number;
  let freezes = l.freezes;
  let froze = false;
  if (l.lastActiveDay < 0) streak = 1;
  else if (gap === 1) streak = l.streak + 1;
  else if (gap === 2 && freezes > 0) {
    freezes -= 1;
    froze = true;
    streak = l.streak + 1;
  } else streak = 1;
  const cap = l.perks.includes("freeze_cap") ? 3 : 2; // Deep Freezer talent widens the bank
  if (streak > 0 && streak % 7 === 0 && !froze) freezes = Math.min(cap, freezes + 1);
  return db.learner.update({ where: { id: "me" }, data: { streak, lastActiveDay: today, freezes } });
}

// ONE source of truth for "what can I review right now". The old code had
// two: this file counted the daily new budget without subtracting what was
// already introduced today, while /api/review/queue subtracted it - so Home
// advertised "Review 10 due" over a queue that returned an empty batch.
// Everything (badge, coach read_state, next-best, the queue itself) now reads
// this, plus the schedule forecast the finished screen shows.
export interface QueueCounts {
  due: number;
  newLeft: number;
  reviewedToday: number;
  newPerDay: number;
  seen: number;
  unseen: number;
  nextDue: number | null;
  dueTomorrow: number;
  due3days: number;
}

export async function queueCounts(preloaded?: { cardId: string; suspended: boolean; state: string; due: number; last: number; reps: number }[]): Promise<QueueCounts> {
  const l = await getLearner();
  const today = dayIndex();
  const u = await contentUserId().catch(() => "me");
  // Task 89 perf: callers that already hold the user's CardState rows (the
  // queue route loads them to build the batch) pass them in - one full scan
  // per request instead of two.
  const all = preloaded ?? (await db.cardState.findMany({ where: { userId: u } }));
  // BYO-material cards (cardId "mat:<id>") share the SAME queue, budget and
  // badge truth as deck cards - the Task-44 lesson: one source of truth.
  const deckStates = all.filter((s) => !s.cardId.startsWith("mat:"));
  const matStates = all.filter((s) => s.cardId.startsWith("mat:"));
  const matNew = matStates.filter((s) => !s.suspended && s.state === "new").length;
  const due = all.filter((s) => !s.suspended && s.state !== "new" && s.due <= today).length;
  const introducedToday = all.filter((s) => s.last === today && s.reps === 1).length;
  const deckKnown = deckStates.filter((s) => s.state !== "new").length;
  const deckUnseen = Math.max(0, DECK.length - deckStates.length);
  const newLeft = Math.max(0, Math.min(l.newPerDay - introducedToday, deckUnseen + matNew));
  const future = all.filter((s) => !s.suspended && s.state !== "new" && s.due > today).map((s) => s.due);
  return {
    due,
    newLeft,
    reviewedToday: introducedToday,
    newPerDay: l.newPerDay,
    seen: all.length,
    unseen: deckUnseen + matNew,
    nextDue: future.length ? Math.min(...future) : null,
    dueTomorrow: future.filter((d) => d <= today + 1).length,
    due3days: future.filter((d) => d <= today + 3).length,
  };
}

export async function dueCount(): Promise<number> {
  const c = await queueCounts();
  // The badge promises what one round actually delivers (capped like the queue).
  return c.due + c.newLeft;
}

// Live learner profile handed to every AI job.
export async function buildProfile(): Promise<ProfileJson> {
  const l = await getLearner();
  const u = await contentUserId().catch(() => "me");
  const today = dayIndex();
  const due = await dueCount();

  // Recent trap tags from the last graded lapses drive AI focus.
  const recent = await db.reviewLog.findMany({
    where: { userId: u, grade: 1 },
    orderBy: { id: "desc" },
    take: 12,
  });
  const traps: string[] = [];
  for (const r of recent) {
    const c = cardById(r.cardId);
    if (c) for (const t of c.traps) if (!traps.includes(t)) traps.push(t);
  }

  // Weakest skills by lapse ratio over cards with reps.
  const states = await db.cardState.findMany({ where: { userId: u, reps: { gt: 3 } } });
  const agg: Record<string, { ok: number; lapse: number }> = {};
  for (const st of states) {
    const c = cardById(st.cardId);
    if (!c) continue;
    agg[c.skill] ??= { ok: 0, lapse: 0 };
    if (st.lapses > 0) agg[c.skill].lapse += st.lapses;
    agg[c.skill].ok += Math.max(1, st.reps - st.lapses);
  }
  const weakSkills = Object.entries(agg)
    .map(([skill, a]) => ({ skill, rate: a.lapse / (a.lapse + a.ok) }))
    .sort((a, b) => b.rate - a.rate)
    .filter((x) => x.rate > 0.15)
    .slice(0, 2)
    .map((x) => x.skill);

  // Persistent mistake families: production corrections across chat, essays
  // and speaking, keyed by trap tag. These drive what the tutor hunts and what
  // exams prioritize - memory instead of rediscovery. Resolved families are
  // excluded (activeOnly): healing must silence the steering, that is the
  // learner-visible reward for getting past a weakness.
  let mistakes: { tag: string; count: number; label: string }[] = [];
  let mistakesHealed = 0;
  try {
    const all = await topMistakes(50);
    mistakes = all
      .filter((m) => !m.resolvedAt)
      .slice(0, 5)
      .map((m) => ({ tag: m.tag, count: m.count, label: m.label }));
    mistakesHealed = all.filter((m) => m.resolvedAt).length;
  } catch {
    // Fresh database or table not yet migrated: the profile works without it.
  }

  return {
    level: l.level === "?" ? "B2" : l.level,
    streak: l.streak,
    focus: l.focusSkill,
    due,
    recentTraps: traps.slice(0, 4),
    weakSkills: weakSkills.length ? weakSkills : ["collocation"],
    mistakes,
    mistakesHealed,
  };
}

// Bottleneck diagnosis for the progress page: find the weakest measurable
// signal and name the fix, the way a human coach would.
export async function diagnose() {
  const today = dayIndex();
  const u = await contentUserId().catch(() => "me");
  const states = await db.cardState.findMany({ where: { userId: u } });
  const bySkill: Record<string, { due: number; lapses: number; reps: number; young: number }> = {};
  for (const st of states) {
    const c = cardById(st.cardId);
    if (!c) continue;
    bySkill[c.skill] ??= { due: 0, lapses: 0, reps: 0, young: 0 };
    if (st.state !== "new" && st.due <= today) bySkill[c.skill].due += 1;
    bySkill[c.skill].lapses += st.lapses;
    bySkill[c.skill].reps += st.reps;
    if (st.s < 3 && st.state === "review") bySkill[c.skill].young += 1;
  }
  const rows = Object.entries(bySkill)
    .map(([skill, a]) => ({
      skill,
      lapseRate: a.reps ? a.lapses / a.reps : 0,
      due: a.due,
      young: a.young,
      reps: a.reps,
    }))
    .sort((a, b) => b.lapseRate - a.lapseRate);

  const l = await getLearner();
  const advice: string[] = [];
  const worst = rows[0];
  if (worst && worst.reps >= 5 && worst.lapseRate > 0.2) {
    advice.push(
      `${worst.skill} is your leakiest skill: ${Math.round(worst.lapseRate * 100)}% of reviews lapse. Drill it in Chat and ask Rah to build 5 fresh cards on it.`,
    );
  }
  if (l.placementPhase !== "done") {
    advice.push("No measured level yet. The placement takes about 10 minutes and tunes every schedule.");
  }
  if (dueCountSafe(states, today) === 0 && rows.length > 0) {
    advice.push("Queue is clear. Feed Rah a text you actually read this week and turn it into cards.");
  }
  return { bySkill: rows, advice };
}

function dueCountSafe(states: { state: string; due: number }[], today: number): number {
  return states.filter((s) => s.state !== "new" && s.due <= today).length;
}
