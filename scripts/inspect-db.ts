// Forensic inspection of the live learner DB: when was it recreated,
// did learner progress survive the last update, what re-fired.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: [] });

async function main() {
  const learner = await db.learner.findUnique({ where: { id: "me" } });
  console.log("== Learner ==");
  if (learner) {
    const { createdAt, ...rest } = learner;
    console.log(JSON.stringify(rest, null, 1));
    console.log("createdAt:", createdAt?.toISOString());
  } else {
    console.log("NO LEARNER ROW");
  }

  const [reviews, achievements, dailyStats, cardStates, chatMsgs, writings, exams, materials, users, skillLevels, gameStats, mistakes, placements] = await Promise.all([
    db.reviewLog.count(),
    db.achievement.findMany({ orderBy: { at: "asc" } }),
    db.dailyStat.findMany({ orderBy: { day: "asc" } }),
    db.cardState.count(),
    db.chatMsg.count(),
    db.writingSub.count(),
    db.exam.count(),
    db.material.count(),
    db.user.findMany({ select: { email: true, createdAt: true } }),
    db.skillLevel.findMany(),
    db.gameStat.count(),
    db.mistakeFamily.count(),
    db.placement.findMany(),
  ]);

  console.log("\n== Counts ==");
  console.log({ reviews, cardStates, chatMsgs, writings, exams, materials, gameStats, mistakes, skillLevels: skillLevels.length, dailyStats: dailyStats.length, users: users.length });

  console.log("\n== Achievements (" + achievements.length + ") ==");
  for (const a of achievements) console.log(`  ${a.key}  at=${a.at.toISOString()}`);

  console.log("\n== DailyStat range ==");
  if (dailyStats.length) {
    console.log(`  first day=${dailyStats[0].day}  last day=${dailyStats[dailyStats.length - 1].day}  rows=${dailyStats.length}`);
    for (const d of dailyStats.slice(-5)) console.log(`   day ${d.day}: reviews=${d.reviews} xp=${d.xp}`);
  } else console.log("  EMPTY");

  console.log("\n== SkillLevels ==");
  for (const s of skillLevels) console.log(`  ${s.skill}: ${s.level} score=${s.score.toFixed(2)} samples=${s.samples}`);

  console.log("\n== Placement ==");
  for (const p of placements) console.log(`  ${p.id}: level=${p.level} phase=${p.phase} updated=${p.updatedAt.toISOString()}`);

  console.log("\n== Users ==");
  for (const u of users) console.log(`  ${u.email} created=${u.createdAt.toISOString()}`);
}

main().catch((e) => {
  console.error("INSPECT FAILED:", e.message);
  process.exit(1);
});
