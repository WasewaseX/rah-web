// Task 18 live drive: exercise the Speed Round and Boss Battle routes end to
// end against the running server, then restore every touched row.
import { db } from "../src/lib/db";

const BASE = "http://localhost:3000";
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
  // ---- Speed Round ----
  const g = await (await fetch(`${BASE}/api/arcade/speed`, { cache: "no-store" })).json();
  check("speed pool 40", (g.items ?? []).length === 40, String(g.items?.length));
  const mcqs = g.items.filter((i: { kind: string }) => i.kind === "mcq");
  const clozes = g.items.filter((i: { kind: string }) => i.kind === "cloze");
  check("mcq items have 4 choices + key among them", mcqs.every((i: { choices: string[]; key: string }) => i.choices.length === 4 && i.choices.includes(i.key)));
  check("cloze items answerable", clozes.every((i: { q: string; accepts: string[] }) => i.accepts.length > 0 && (i.q.includes("___") || /^[^\x00-\x7F]/.test(i.q))));
  check("no duplicate item ids", new Set(g.items.map((i: { id: string }) => i.id)).size === 40);

  // Snapshot before POSTs
  const learner0 = await db.learner.findUnique({ where: { id: "me" } });
  const day = Math.floor(Date.now() / 86400000);
  const stat0 = await db.dailyStat.findUnique({ where: { userId_day: { userId: "me", day } } });
  const stats0 = await db.gameStat.findMany();
  const quests0 = await db.quest.findMany();

  const post = await (
    await fetch(`${BASE}/api/arcade/speed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 320, correct: 20, total: 24, maxCombo: 9, ms: 60000 }),
    })
  ).json();
  check("speed xpGain = round(320/12)", post.xpGain === Math.round(320 / 12), String(post.xpGain));
  check("speed best recorded", post.best === 320 && post.isNewBest === true, JSON.stringify({ best: post.best, isNew: post.isNewBest }));
  check("speed bestCombo recorded", post.bestCombo === 9, String(post.bestCombo));

  // Tamper attempt: a 999999 score with weak accuracy (6 hits, best combo 2)
  // must clamp to the physical ceiling for those numbers: 10*tri(2) + 50*4 = 230,
  // which is BELOW the legit 320 already on the board - so no new best.
  const cheat = await (
    await fetch(`${BASE}/api/arcade/speed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 999999, correct: 6, total: 40, maxCombo: 2, ms: 60000 }),
    })
  ).json();
  check("cheat score clamped to accuracy ceiling (230 < 320)", cheat.isNewBest === false && cheat.best === 320, JSON.stringify({ best: cheat.best, isNew: cheat.isNewBest }));

  // ---- Boss Battle ----
  const boss = await (await fetch(`${BASE}/api/arcade/boss`, { cache: "no-store" })).json();
  check("boss 3 phases x 8", boss.phases?.length === 3 && boss.phases.every((p: { items: unknown[] }) => p.items.length === 8));
  check("boss phases have taunts", boss.phases.every((p: { taunt: string }) => typeof p.taunt === "string" && p.taunt.length > 10));
  const bossPost = await (
    await fetch(`${BASE}/api/arcade/boss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ won: true, phaseReached: 3, heartsLeft: 3, correct: 24, total: 24 }),
    })
  ).json();
  check("boss flawless xp = 180", bossPost.xpGain === 180, String(bossPost.xpGain));

  // Engine effects
  const stats1 = await db.gameStat.findMany();
  const get = (rows: { key: string; best: number }[], k: string) => rows.find((r) => r.key === k)?.best ?? 0;
  check("stat speed:best=320", get(stats1, "speed:best") === 320, String(get(stats1, "speed:best")));
  check("stat speed:combo=9", get(stats1, "speed:combo") === 9, String(get(stats1, "speed:combo")));
  check("stat boss:wins=1", get(stats1, "boss:wins") === 1, String(get(stats1, "boss:wins")));
  check("stat boss:flawless=1", get(stats1, "boss:flawless") === 1, String(get(stats1, "boss:flawless")));
  const quests1 = await db.quest.findMany({ where: { day } });
  const qSpeedPlay = quests1.find((q) => q.key === "speed_play");
  const qCombo = quests1.find((q) => q.key === "speed_combo_8");
  const qBoss = quests1.find((q) => q.key === "boss_win");
  const qPhase = quests1.find((q) => q.key === "boss_phase");
  if (qSpeedPlay) check("quest speed_play done", qSpeedPlay.done);
  if (qCombo) check("quest speed_combo_8 done (9>=8)", qCombo.done);
  if (qBoss) check("quest boss_win done", qBoss.done);
  if (qPhase) check("quest boss_phase done (3>=2)", qPhase.done);
  const achievements = await db.achievement.findMany();
  check("speed_demon unlocked (320>=300)", achievements.some((a) => a.key === "speed_demon"));
  check("boss_slayer unlocked", achievements.some((a) => a.key === "boss_slayer"));
  check("boss_flawless unlocked", achievements.some((a) => a.key === "boss_flawless"));

  // ---- Restore ----
  await db.learner.update({ where: { id: "me" }, data: { xp: learner0?.xp ?? 0, freezes: learner0?.freezes ?? 0 } });
  if (stat0) await db.dailyStat.update({ where: { userId_day: { userId: "me", day } }, data: { reviews: stat0.reviews, correct: stat0.correct, xp: stat0.xp, spoken: stat0.spoken, written: stat0.written, listened: stat0.listened } });
  else await db.dailyStat.deleteMany({ where: { userId: "me", day } });
  for (const s of stats0) await db.gameStat.update({ where: { userId_key: { userId: "me", key: s.key } }, data: { best: s.best, plays: s.plays } }).catch(() => undefined);
  for (const s of stats1) if (!stats0.find((x) => x.key === s.key)) await db.gameStat.delete({ where: { userId_key: { userId: "me", key: s.key } } }).catch(() => undefined);
  for (const q of quests0) await db.quest.update({ where: { userId_id: { userId: "me", id: q.id } }, data: { progress: q.progress, done: q.done } }).catch(() => undefined);
  const achKeys = new Set((await (await import("../src/lib/arcade")).ACHIEVEMENTS).map((a) => a.key));
  for (const a of achievements) if (!achKeys.has(a.key)) await db.achievement.delete({ where: { userId_key: { userId: "me", key: a.key } } }).catch(() => undefined);

  console.log(`\nARCADE LIVE ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
