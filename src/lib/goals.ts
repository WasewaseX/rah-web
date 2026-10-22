// Goal planner (audit P2, Task 65). The learner states the goal; Rah turns it
// into a weekly plan from REAL, measured data - no AI writes this:
//   - the FSRS due-load forecast (how many reviews the deck will demand),
//   - the trailing 14-day activity record (whether the plan fits the
//     learner's actual practice rhythm, not their intention),
//   - the mastery ledger's danger tags (what to prioritize first).
// Every number traces to a table row. Feasibility says the honest thing:
// a plan that does not match observed behavior is labeled tight or
// overcommitted, never "you've got this!".

import { db } from "@/lib/db";
import { dayIndex } from "@/lib/fsrs";
import { contentUserId } from "@/lib/scope";
import { getMasteryView } from "@/lib/mastery";

export interface GoalView {
  id: string;
  title: string;
  kind: string;
  target: string;
  dueDay: number | null;
  weeklySessions: number;
  createdAt: string;
  archivedAt: string | null;
}

function toView(g: {
  id: string; title: string; kind: string; target: string; dueDay: number | null;
  weeklySessions: number; createdAt: Date; archivedAt: Date | null;
}): GoalView {
  return {
    id: g.id,
    title: g.title,
    kind: g.kind,
    target: g.target,
    dueDay: g.dueDay,
    weeklySessions: g.weeklySessions,
    createdAt: g.createdAt.toISOString(),
    archivedAt: g.archivedAt ? g.archivedAt.toISOString() : null,
  };
}

async function actor(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  try {
    return await contentUserId();
  } catch {
    return "me";
  }
}

export async function listGoals(userId?: string): Promise<{ active: GoalView[]; archived: GoalView[] }> {
  const u = await actor(userId);
  const [active, archived] = await Promise.all([
    db.goal.findMany({ where: { userId: u, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.goal.findMany({ where: { userId: u, archivedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { active: active.map(toView), archived: archived.map(toView) };
}

export interface GoalInput {
  title: string;
  kind?: string;
  target?: string;
  dueDay?: number | null;
  weeklySessions?: number;
}

const KINDS = new Set(["exam", "level", "habit"]);

export async function createGoal(input: GoalInput, userId?: string): Promise<{ ok: boolean; goal?: GoalView; error?: string }> {
  const u = await actor(userId);
  const title = String(input.title ?? "").trim().slice(0, 140);
  if (title.length < 3) return { ok: false, error: "Give the goal a name (3-140 characters)." };
  const kind = KINDS.has(String(input.kind ?? "")) ? String(input.kind) : "habit";
  const target = String(input.target ?? "").trim().slice(0, 200);
  const weekly = Math.max(1, Math.min(7, Math.round(Number(input.weeklySessions ?? 4))));
  const due = input.dueDay === null || input.dueDay === undefined ? null : Math.max(dayIndex(), Math.round(Number(input.dueDay)));
  try {
    const g = await db.goal.create({ data: { userId: u, title, kind, target, dueDay: due, weeklySessions: weekly } });
    return { ok: true, goal: toView(g) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Archive, never delete: the record of what was planned survives what
// actually happened. That is the point of a planner.
export async function archiveGoal(id: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
  const u = await actor(userId);
  if (!id) return { ok: false, error: "id required" };
  try {
    const res = await db.goal.updateMany({ where: { id, userId: u, archivedAt: null }, data: { archivedAt: new Date() } });
    return res.count === 1 ? { ok: true } : { ok: false, error: "goal not found" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export interface GoalPlan {
  dueForecast: { day: number; count: number }[];
  dueTotal: number;
  dailyReviews: number;
  sessionMinutes: number;
  weeklyMinutes: number;
  avgActiveDays14: number;
  avgXp14: number;
  feasibility: "on_track" | "tight" | "overcommitted" | "no_data";
  feasibilityNote: string;
  priorities: string[];
}

// ~6 reviews a minute is the observed review pace; every session also carries
// one 10-minute skill task (speak, write or coach) - that is the shape of a
// real practice day in this app, so the plan is stated in those terms.
const REVIEWS_PER_MINUTE = 6;
const SKILL_BLOCK_MINUTES = 10;

export async function planFor(userId?: string): Promise<GoalPlan> {
  const u = await actor(userId);
  const today = dayIndex();

  const dueRows = await db.cardState.findMany({
    where: { userId: u, suspended: false, due: { lte: today + 7 } },
    select: { due: true },
  });
  const buckets = new Map<number, number>();
  for (const r of dueRows) {
    const d = Math.max(today, Math.min(today + 6, r.due));
    buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  const dueForecast = Array.from({ length: 7 }, (_, i) => ({ day: today + i, count: buckets.get(today + i) ?? 0 }));
  const dueTotal = dueForecast.reduce((s, f) => s + f.count, 0);
  const dailyReviews = Math.ceil(dueTotal / 7);
  const sessionMinutes = dailyReviews > 0 ? Math.ceil(dailyReviews / REVIEWS_PER_MINUTE) + SKILL_BLOCK_MINUTES : SKILL_BLOCK_MINUTES;

  const stats = await db.dailyStat.findMany({ where: { userId: u, day: { gte: today - 13, lt: today } } });
  const activeDays = stats.filter((s) => s.reviews > 0 || s.spoken > 0 || s.written > 0 || s.listened > 0).length;
  const avgActiveDays14 = Math.round((activeDays / 14) * 7 * 10) / 10; // practice days per week, observed
  const avgXp14 = Math.round(stats.reduce((s, r) => s + r.xp, 0) / 14);

  const mastery = await getMasteryView(u);
  const priorities = [...mastery.danger, ...mastery.fragile].slice(0, 3);

  let feasibility: GoalPlan["feasibility"];
  let feasibilityNote: string;
  if (stats.length === 0) {
    feasibility = "no_data";
    feasibilityNote = "No activity rows yet - the feasibility check needs about a week of real practice to say anything honest.";
  } else if (avgActiveDays14 >= 5.5 && dueTotal > 0) {
    feasibility = "on_track";
    feasibilityNote = `Observed rhythm ${avgActiveDays14} practice days/week covers the load: about ${dailyReviews} review${dailyReviews === 1 ? "" : "s"}/day (${dueTotal} due this week), roughly ${sessionMinutes} min per session.`;
  } else if (avgActiveDays14 >= 3) {
    feasibility = "tight";
    feasibilityNote = `The deck will demand about ${dailyReviews} reviews/day (${dueTotal} this week, ~${sessionMinutes} min/session). Your observed rhythm is ${avgActiveDays14} practice days/week - one more session a week keeps the queue from snowballing.`;
  } else {
    feasibility = "overcommitted";
    feasibilityNote = `Observed rhythm is ${avgActiveDays14} practice days/week, but ${dailyReviews} reviews/day (~${sessionMinutes} min) is queued this week. Cut new cards for a few days or clear the backlog before promising more sessions.`;
  }

  return { dueForecast, dueTotal, dailyReviews, sessionMinutes, weeklyMinutes: sessionMinutes * 7, avgActiveDays14, avgXp14, feasibility, feasibilityNote, priorities };
}
