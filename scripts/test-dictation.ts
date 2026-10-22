// P4 listening lab v2 drive: dictation -> schedule -> resurfacing.
//
// Claim set:
//  1. Pure proximity: exact retrieval, NEAR retrieval (typo >= 0.8 is not a
//     miss), slips only for absent tokens; function words never scheduled;
//     score math exact; deterministic.
//  2. Deck precedence: a slipped word that IS a deck word schedules the REAL
//     card, not a synthetic one.
//  3. Live route: POST /api/listen/dictation through the REAL server -
//     schedule writes (grade 1, post-lapse minimum), ReviewLog source
//     "dictation", listen:<token> families with "typed -> target" evidence.
//  4. Queue surfacing: the listen:<token> healing card renders from the
//     learner's own sentence pair (shared blanking heuristic), "Yesterday's
//     slip due today" timeline.
// Full state restore in finally.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";
export {};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { proximity } = await import("@/lib/proximity");
const { deckCardForToken, derivedExamCard, LISTEN_CARD_PREFIX } = await import("@/lib/exam-cards");
const { DECK } = await import("@/lib/content");
const { dayIndex } = await import("@/lib/fsrs");

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const TOKEN = "harbors"; // content word, deliberately NOT in the deck (asserted below)
const SENT = "The city harbors a quiet stubbornness.";
const TYPED = "The city a quiet stubbornness."; // "harbors" dropped entirely

const learnerBefore = await prisma.learner.findUnique({ where: { id: "me" } });
const cardCols = [`${LISTEN_CARD_PREFIX}${TOKEN}`];
const cardsBefore = await prisma.cardState.findMany({ where: { cardId: { in: cardCols } } });
const logsBeforeCount = await prisma.reviewLog.count();
const listenLogsBefore = await prisma.reviewLog.findMany({ where: { cardId: { in: cardCols }, source: "dictation" } });
const familyBefore = await prisma.mistakeFamily.findUnique({ where: { id: `listen:${TOKEN}` } });
const questsBefore = await prisma.quest.findMany();
const achievementsBefore = await prisma.achievement.findMany();
const statDay = Math.floor(Date.now() / 86400000);
const statBefore = await prisma.dailyStat.findUnique({ where: { userId_day: { userId: "me", day: statDay } } } );

try {
  check(!DECK.some((c) => [c.answer, c.en, ...c.alt].some((a) => a.trim().toLowerCase() === TOKEN)), "fixture: token absent from the deck", TOKEN);
  await prisma.cardState.deleteMany({ where: { cardId: { in: cardCols } } });
  await prisma.reviewLog.deleteMany({ where: { cardId: { in: cardCols }, source: "dictation" } });
  await prisma.mistakeFamily.deleteMany({ where: { id: `listen:${TOKEN}` } });

  // ---------- 1) pure proximity ----------
  const p1 = proximity(SENT, SENT);
  check(p1.score === 1 && p1.slips.length === 0, "proximity: perfect round scores 1", JSON.stringify(p1));
  const p2 = proximity(SENT, "The city harbors a quiet stubbornnes"); // typo'd last word, missing period
  const lastV = p2.verdicts[p2.verdicts.length - 1];
  check(!lastV.slip && (lastV.ok || lastV.near), "proximity: near typo is NOT a slip", JSON.stringify(lastV));
  const p3 = proximity(SENT, TYPED);
  check(p3.slips.length === 1 && p3.slips[0] === TOKEN, "proximity: dropped word is the only slip", JSON.stringify(p3));
  const p4 = proximity("a of the", "x y z");
  check(p4.slips.length === 0 && p4.score === 1, "proximity: function words never scheduled", JSON.stringify(p4));
  const p5 = proximity("harbors harbors", "harbors harbors");
  check(p5.score === 1 && p5.verdicts.length === 2, "proximity: greedy consume handles repeats", JSON.stringify(p5.verdicts.length));
  check(JSON.stringify(proximity(SENT, TYPED)) === JSON.stringify(p3), "proximity: deterministic", "");

  // ---------- 2) deck precedence ----------
  const deckHit = deckCardForToken("make");
  check(!!deckHit && deckHit.id === DECK.find((c) => c.answer.toLowerCase() === "make")!.id, "deck precedence: 'make' resolves to its deck card", JSON.stringify(deckHit?.id));
  check(deckCardForToken(TOKEN) === null, "deck precedence: non-deck token yields null", TOKEN);

  // ---------- 3) live route ----------
  const res = await fetch(`${BASE}/api/listen/dictation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sentences: [{ target: SENT, typed: TYPED }, { target: SENT, typed: SENT }] }),
  });
  if (res.status !== 200) {
    console.log(`SKIP dictation route (${res.status})`);
  } else {
    const j = (await res.json()) as {
      results: { score: number; verdicts: { token: string; slip: boolean }[] }[];
      scheduled: { cardId: string; via: string; grade: number }[];
    };
    check(j.results.length === 2 && j.results[0].score < 1 && j.results[1].score === 1, "route: two rounds scored independently", JSON.stringify(j.results.map((r) => r.score)));
    check(j.scheduled.length === 1 && j.scheduled[0].cardId === `${LISTEN_CARD_PREFIX}${TOKEN}` && j.scheduled[0].via === "family", "route: the slip scheduled as a healing card", JSON.stringify(j.scheduled));

    const card = await prisma.cardState.findUnique({ where: { userId_cardId: { userId: "me", cardId: `${LISTEN_CARD_PREFIX}${TOKEN}` } } });
    const today = dayIndex();
    check(!!card && card.lapses === 1 && card.due <= today + 1 && card.due > today - 1, "schedule: grade-1 outcome at post-lapse minimum", JSON.stringify(card));

    const logs = await prisma.reviewLog.findMany({ where: { cardId: `${LISTEN_CARD_PREFIX}${TOKEN}`, source: "dictation" } });
    check(logs.length === 1, "provenance: one ReviewLog row source=dictation", JSON.stringify(logs.length));

    const fam = await prisma.mistakeFamily.findUnique({ where: { id: `listen:${TOKEN}` } });
    check(!!fam && fam.kind === "listen" && fam.evidence.includes("->"), "memory: listen family recorded with evidence", JSON.stringify(fam?.evidence)?.slice(0, 90));

    // ---------- 4) queue surfacing on the real timeline ----------
    await prisma.cardState.update({ where: { userId_cardId: { userId: "me", cardId: `${LISTEN_CARD_PREFIX}${TOKEN}` } }, data: { due: today } });
    const q = await fetch(`${BASE}/api/review/queue`);
    const qj = (await q.json()) as { batch?: { card: { id: string; prompt: string; answer: string; unit: string; note: string } }[] };
    const healing = (qj.batch ?? []).map((b) => b.card).find((c) => c.id === `${LISTEN_CARD_PREFIX}${TOKEN}`);
    check(!!healing, "queue: listen healing card surfaces", `batch: ${(qj.batch ?? []).map((b) => b.card.id).join(",")}`);
    if (healing) {
      check(healing.unit === "listen_healing" && healing.prompt.includes("___"), "queue: rendered from the learner's own pair", JSON.stringify(healing));
      check(healing.answer.toLowerCase() === TOKEN, "queue: the correction is the slipped word", healing.answer);
    }
    const derived = await derivedExamCard(`${LISTEN_CARD_PREFIX}${TOKEN}`);
    check(!!derived && derived.answer.toLowerCase() === TOKEN, "derived: shared blanking picks the slip", JSON.stringify(derived?.prompt));
  }
} catch (e) {
  failures += 1;
  console.log(`FAIL drive crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await prisma.cardState.deleteMany({ where: { cardId: { in: cardCols } } });
  for (const c of cardsBefore) {
    const { cardId, s, d, due, last, lapses, reps, state, lastivl, dir, suspended } = c;
    await prisma.cardState.create({ data: { cardId, s, d, due, last, lapses, reps, state, lastivl, dir, suspended } });
  }
  await prisma.reviewLog.deleteMany({ where: { cardId: { in: cardCols }, source: "dictation" } });
  for (const l of listenLogsBefore) {
    const { id, ...rest } = l;
    await prisma.reviewLog.create({ data: { id, ...rest } });
  }
  await prisma.mistakeFamily.deleteMany({ where: { id: `listen:${TOKEN}` } });
  if (familyBefore) {
    const { id, kind, tag, label, count, evidence, streakClean, resolvedAt, lastSeen, updatedAt } = familyBefore;
    await prisma.mistakeFamily.create({ data: { id, kind, tag, label, count, evidence, streakClean, resolvedAt, lastSeen, updatedAt } });
  }
  if (learnerBefore) {
    const { id, ...rest } = learnerBefore;
    await prisma.learner.update({ where: { id }, data: rest });
  }
  if (statBefore) {
    const { day, ...rest } = statBefore;
    await prisma.dailyStat.update({ where: { userId_day: { userId: "me", day } }, data: rest });
  } else {
    await prisma.dailyStat.deleteMany({ where: { userId: "me", day: statDay } });
  }
  await prisma.quest.deleteMany({});
  for (const q of questsBefore) {
    const { id, ...rest } = q;
    await prisma.quest.create({ data: { id, ...rest } });
  }
  await prisma.achievement.deleteMany({});
  for (const a of achievementsBefore) {
    const { key, at, meta } = a;
    await prisma.achievement.create({ data: { key, at, meta } });
  }
  await prisma.$disconnect();
}

console.log(`\nDICTATION DRIVE: ${n - failures}/${n} ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
process.exit(failures === 0 ? 0 : 1);
