// Goal planner battery (Task 65). Deterministic plan math + scoping, on a
// THROWAWAY database with explicit userIds. Run:
//   DATABASE_URL=file:/home/z/my-project/db/battery-goals.db bun scripts/test-goals.ts
// (push schema first with the same URL)

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/battery-goals.db";
export {}; // top-level await needs a module

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { listGoals, createGoal, archiveGoal, planFor } = await import("../src/lib/goals");
const { dayIndex } = await import("../src/lib/fsrs");

let pass = 0;
let fail = 0;
function check(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? " - " + detail : ""}`);
  }
}

await prisma.goal.deleteMany();
await prisma.dailyStat.deleteMany();
await prisma.cardState.deleteMany();
await prisma.tagMastery.deleteMany();

// 1. validation
const bad1 = await createGoal({ title: "ab" }, "u1");
check(!bad1.ok, "short title rejected", JSON.stringify(bad1));
const ok1 = await createGoal({ title: "IELTS 6.5 by spring", kind: "exam", weeklySessions: 99 }, "u1");
check(ok1.ok && ok1.goal?.weeklySessions === 7, "weeklySessions clamped to 7", JSON.stringify(ok1.goal));
const ok2 = await createGoal({ title: "5 practice days a week", kind: "nonsense" }, "u1");
check(ok2.ok && ok2.goal?.kind === "habit", "unknown kind falls back to habit", JSON.stringify(ok2.goal));

// 2. per-user scoping
await createGoal({ title: "B2 by March", kind: "level" }, "u2");
const u1list = await listGoals("u1");
const u2list = await listGoals("u2");
check(u1list.active.length === 2 && u2list.active.length === 1, "goals are per-user", JSON.stringify({ u1: u1list.active.length, u2: u2list.active.length }));
check(u1list.active.every((g) => g.title !== "B2 by March"), "u1 does not see u2's goal");

// 3. archive, never delete
const arch = await archiveGoal(u1list.active[0].id, "u2");
check(!arch.ok, "cross-user archive refused", JSON.stringify(arch));
const archOk = await archiveGoal(u1list.active[0].id, "u1");
check(archOk.ok, "owner archive succeeds");
const after = await listGoals("u1");
check(after.active.length === 1 && after.archived.length === 1, "archived goal kept in history", JSON.stringify({ a: after.active.length, h: after.archived.length }));

// 4. plan: deterministic from seeded due load + activity
const today = dayIndex();
await prisma.cardState.createMany({
  // Per-user keys (Task 67 scoping): the plan forecasts for "u1", so the
  // seeds must carry "u1" - unscoped rows would land on the "me" singleton
  // and the forecast would honestly read zero (caught re-running the gates
  // on the merged parallel-wave tree).
  data: [
    { userId: "u1", cardId: "g1", due: today + 1 },
    { userId: "u1", cardId: "g2", due: today + 1 },
    { userId: "u1", cardId: "g3", due: today + 2 },
    { userId: "u1", cardId: "g4", due: today + 2 },
    { userId: "u1", cardId: "g5", due: today + 2 },
    { userId: "u1", cardId: "g6", due: today - 3 },
    { userId: "u1", cardId: "g7", due: today + 30, suspended: false }, // beyond the 7-day window
    { userId: "u1", cardId: "g8", due: today + 1, suspended: true }, // suspended never counts
  ],
});
await prisma.dailyStat.createMany({
  data: [
    { userId: "u1", day: today - 1, reviews: 30, xp: 90 },
    { userId: "u1", day: today - 2, reviews: 30, xp: 90 },
    { userId: "u1", day: today - 3, reviews: 30, xp: 90 },
    { userId: "u1", day: today - 4, reviews: 30, xp: 90 },
    { userId: "u1", day: today - 5, reviews: 30, xp: 90 },
    { userId: "u1", day: today - 6, reviews: 0, xp: 0 },
  ],
});
const plan = await planFor("u1");
check(plan.dueTotal === 6, "due forecast counts in-window unsuspended cards", JSON.stringify({ total: plan.dueTotal }));
check(plan.dailyReviews === 1 && plan.sessionMinutes === 11, "session math: 1 review/day -> 1 min + 10 min skill block", JSON.stringify({ d: plan.dailyReviews, m: plan.sessionMinutes }));
check(plan.avgActiveDays14 === 2.5, "observed rhythm: 5 active days / 14 = 2.5 per week", String(plan.avgActiveDays14));
check(plan.feasibility === "overcommitted", "2.5 observed days/week labels the plan overcommitted (honest)", plan.feasibility);
check(/2.5 practice days/.test(plan.feasibilityNote), "feasibility note carries the observed number", plan.feasibilityNote);
const plan2 = await planFor("u1");
check(JSON.stringify(plan) === JSON.stringify(plan2), "plan is deterministic (same DB state, same plan)");
const empty = await planFor("u3");
// NOTE: CardState (the FSRS deck queue) is still single-deck/global - the
// known residual from the isolation sweep. u3 sees the shared due load but no
// personal activity, hence no_data feasibility.
check(empty.feasibility === "no_data" && empty.avgXp14 === 0, "user with no activity gets the honest no_data plan", `${empty.feasibility} due=${empty.dueTotal}`);

await prisma.$disconnect();
console.log(`\ngoal battery: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
