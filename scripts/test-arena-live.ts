// Task 20 live drive: Voice Arena scorer (unit) + endpoint (live) with restore.
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
  const { scoreShadow } = await import("../src/lib/arena-score");

  // Unit: perfect shadow
  const s1 = scoreShadow("She has already finished her homework", "she has already finished her homework");
  check("perfect shadow = 100", s1.accuracy === 100, String(s1.accuracy));
  // Unit: missed endings/words
  const s2 = scoreShadow("I would have gone to the party", "i would gone to the party");
  check("missed word detected", s2.missed.includes("have") && s2.accuracy < 100, JSON.stringify(s2));
  // Unit: extra words penalized
  const s3 = scoreShadow("call me tomorrow", "well call me tomorrow okay");
  check("extra words penalized", s3.extra.length >= 2 && s3.accuracy < 100, JSON.stringify(s3));
  // Unit: garbage
  const s4 = scoreShadow("the weather is nice today", "la la la");
  check("garbage scores low", s4.accuracy <= 34, String(s4.accuracy));

  // Live: GET drills
  const g = await (await fetch(`${BASE}/api/arena/voice`, { cache: "no-store" })).json();
  check("5 drills", (g.drills ?? []).length === 5, String(g.drills?.length));
  check("drills speakable (4-14 words)", g.drills.every((d: { en: string }) => d.en.split(/\s+/).length >= 4 && d.en.split(/\s+/).length <= 14));

  // Live: POST a rep with restore
  const learner0 = await db.learner.findUnique({ where: { id: "me" } });
  const day = Math.floor(Date.now() / 86400000);
  const stat0 = await db.dailyStat.findUnique({ where: { userId_day: { userId: "me", day } } });
  const quests0 = await db.quest.findMany();
  const sess0 = await db.speakSession.count();

  const target = "She has already finished her homework";
  const p = await (
    await fetch(`${BASE}/api/arena/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, transcript: "she has already finished her homework" }),
    })
  ).json();
  check("perfect rep pays 30 XP", p.xpGain === 30, String(p.xpGain));
  check("score.accuracy 100", p.score?.accuracy === 100);
  const learner1 = await db.learner.findUnique({ where: { id: "me" } });
  check("learner xp +30", (learner1?.xp ?? 0) === (learner0?.xp ?? 0) + 30);
  const sess1 = await db.speakSession.count();
  check("arena rep logged", sess1 === sess0 + 1);

  // Restore
  await db.learner.update({ where: { id: "me" }, data: { xp: learner0?.xp ?? 0 } });
  if (stat0) await db.dailyStat.update({ where: { userId_day: { userId: "me", day } }, data: { reviews: stat0.reviews, correct: stat0.correct, xp: stat0.xp, spoken: stat0.spoken, written: stat0.written, listened: stat0.listened } });
  else await db.dailyStat.deleteMany({ where: { userId: "me", day } });
  for (const q of quests0) await db.quest.update({ where: { userId_id: { userId: "me", id: q.id } }, data: { progress: q.progress, done: q.done } }).catch(() => undefined);
  const logs = await db.speakSession.findMany({ orderBy: { id: "desc" }, take: sess1 - sess0 });
  for (const row of logs) await db.speakSession.delete({ where: { id: row.id } }).catch(() => undefined);

  console.log(`\nVOICE ARENA ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
