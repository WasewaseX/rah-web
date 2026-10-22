// Task 17 engine smoke: one review grade must flow through the whole arcade
// engine - XP awarded, level math, quest progress, DailyStat - and every
// touched row is restored afterwards so the learner's real state is untouched.
import { db } from "../src/lib/db";

const BASE = "http://localhost:3000";
const CARD = "col001";
let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name} ${detail}`);
  }
}

async function main() {
  // Snapshot
  const learner = await db.learner.findUnique({ where: { id: "me" } });
  const xp0 = learner?.xp ?? 0;
  const freezes0 = learner?.freezes ?? 0;
  const day = Math.floor(Date.now() / 86400000); // dayIndex() is UTC epoch days; mirror it
  const stat0 = await db.dailyStat.findUnique({ where: { userId_day: { userId: "me", day } } });
  const card0 = await db.cardState.findUnique({ where: { userId_cardId: { userId: "me", cardId: CARD } } });
  const quests0 = await db.quest.findMany();
  const logs0 = await db.reviewLog.count();
  const ach0 = await db.achievement.findMany();

  // Grade one review (Good = 3). Momentum is neutralized first so the XP
  // check stays deterministic: no chain means the 1.0x heat multiplier.
  const chainSnap = await db.learner.findUnique({ where: { id: "me" } });
  await db.learner.update({ where: { id: "me" }, data: { chain: 0, chainDay: -1 } });
  const r = await fetch(`${BASE}/api/review/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId: CARD, grade: 3, dir: "cloze" }),
  });
  check("grade 200", r.ok, String(r.status));
  const g = await r.json();
  check("previews present", Array.isArray(g.previews) && g.previews.length === 4);

  // Engine effects
  const learner2 = await db.learner.findUnique({ where: { id: "me" } });
  check("xp +10", (learner2?.xp ?? 0) === xp0 + 10, `${xp0} -> ${learner2?.xp}`);
  const stat2 = await db.dailyStat.findUnique({ where: { userId_day: { userId: "me", day } } });
  check("daily xp +10", (stat2?.xp ?? 0) === (stat0?.xp ?? 0) + 10);
  check("daily reviews +1", (stat2?.reviews ?? 0) === (stat0?.reviews ?? 0) + 1);
  const quests2 = await db.quest.findMany({ where: { day, key: { in: ["reviews_20", "reviews_35", "correct_15"] } } });
  const qBefore = new Map(quests0.map((q) => [q.key, q.progress]));
  const q20 = quests2.find((q) => q.key === "reviews_20");
  check("quest reviews progressed", q20 ? q20.progress === (qBefore.get("reviews_20") ?? 0) + 1 : true, q20 ? `${qBefore.get("reviews_20")} -> ${q20.progress}` : "not in today's pick");
  const logs2 = await db.reviewLog.count();
  check("review log +1", logs2 === logs0 + 1);

  // Level math sanity
  const { levelView, levelFromXp, xpToReach } = await import("../src/lib/arcade");
  check("levelFromXp(0)=1", levelFromXp(0) === 1);
  check("xpToReach(2)=50", xpToReach(2) === 50);
  const lv = levelView(xp0 + 10);
  check("levelView monotonic", lv.nextAt === null || lv.pct >= 0 && lv.pct <= 100);

  // Restore everything
  await db.learner.update({ where: { id: "me" }, data: { xp: xp0, freezes: freezes0, chain: chainSnap?.chain ?? 0, chainDay: chainSnap?.chainDay ?? -1 } });
  if (stat0) await db.dailyStat.update({ where: { userId_day: { userId: "me", day } }, data: { reviews: stat0.reviews, correct: stat0.correct, xp: stat0.xp, spoken: stat0.spoken, written: stat0.written, listened: stat0.listened } });
  else await db.dailyStat.deleteMany({ where: { userId: "me", day } });
  if (card0) {
    await db.cardState.update({ where: { userId_cardId: { userId: "me", cardId: CARD } }, data: { ...card0 } });
  } else {
    await db.cardState.deleteMany({ where: { userId: "me", cardId: CARD } });
  }
  const logsNow = await db.reviewLog.findMany({ orderBy: { id: "desc" }, take: logs2 - logs0 });
  for (const row of logsNow) await db.reviewLog.delete({ where: { id: row.id } });
  for (const q of quests0) {
    await db.quest.update({ where: { userId_id: { userId: "me", id: q.id } }, data: { progress: q.progress, done: q.done } }).catch(() => undefined);
  }
  const achNow = await db.achievement.findMany();
  for (const a of achNow) if (!ach0.find((x) => x.key === a.key)) await db.achievement.delete({ where: { userId_key: { userId: "me", key: a.key } } });

  console.log(`\nENGINE SMOKE ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
