// Shared server-side helpers: learner state, streak, live profile, diagnosis.

import { db } from "@/lib/db";
import { DECK, cardById } from "@/lib/content";
import { dayIndex } from "@/lib/fsrs";
import { topMistakes } from "@/lib/mistakes";
import type { ProfileJson } from "@/lib/ai";

export async function getLearner() {
  let l = await db.learner.findUnique({ where: { id: "me" } });
  if (!l) l = await db.learner.create({ data: { id: "me" } });
  return l;
}

export async function bumpDaily(field: "reviews" | "correct" | "xp" | "spoken" | "written" | "listened", inc = 1) {
  const day = dayIndex();
  await db.dailyStat.upsert({
    where: { day },
    create: { day, [field]: inc },
    update: { [field]: { increment: inc } },
  });
}

export async function touchStreak() {
  const l = await getLearner();
  const today = dayIndex();
  if (l.lastActiveDay === today) return l;
  const streak = l.lastActiveDay === today - 1 ? l.streak + 1 : 1;
  return db.learner.update({ where: { id: "me" }, data: { streak, lastActiveDay: today } });
}

export async function dueCount(): Promise<number> {
  const l = await getLearner();
  const today = dayIndex();
  const due = await db.cardState.count({ where: { state: { not: "new" }, due: { lte: today }, suspended: false } });
  const seen = await db.cardState.count();
  const newBudget = Math.max(0, Math.min(l.newPerDay, DECK.length - seen));
  return due + newBudget;
}

// Live learner profile handed to every AI job.
export async function buildProfile(): Promise<ProfileJson> {
  const l = await getLearner();
  const today = dayIndex();
  const due = await dueCount();

  // Recent trap tags from the last graded lapses drive AI focus.
  const recent = await db.reviewLog.findMany({
    where: { grade: 1 },
    orderBy: { id: "desc" },
    take: 12,
  });
  const traps: string[] = [];
  for (const r of recent) {
    const c = cardById(r.cardId);
    if (c) for (const t of c.traps) if (!traps.includes(t)) traps.push(t);
  }

  // Weakest skills by lapse ratio over cards with reps.
  const states = await db.cardState.findMany({ where: { reps: { gt: 3 } } });
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
  // exams prioritize - memory instead of rediscovery.
  let mistakes: { tag: string; count: number; label: string }[] = [];
  try {
    mistakes = (await topMistakes(5)).map((m) => ({ tag: m.tag, count: m.count, label: m.label }));
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
  };
}

// Bottleneck diagnosis for the progress page: find the weakest measurable
// signal and name the fix, the way a human coach would.
export async function diagnose() {
  const today = dayIndex();
  const states = await db.cardState.findMany();
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
