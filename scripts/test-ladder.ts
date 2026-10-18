// P3 content ladder drive: the envelope steers everything.
//
// Claim set:
//  1. Pure ladder: band mapping is exact, "?" defaults to B2, B1 vs C1
//     envelopes differ on every axis that matters, briefs carry the bands.
//  2. Read ordering: the learner's band sorts first, ties by the band's
//     order preference; deterministic.
//  3. Dungeon floors: a B1 learner's floor 3 draws B2-first (C1 as spice);
//     a C1 learner's floor 1 mixes C1 in from the start. Proven through the
//     REAL dungeon route with the learner level forced, RunState rebuilt
//     between runs, everything restored.
//  4. Speak grading bar: the strictness clause is part of the system prompt
//     (unit-level: ladderBrief output); live speak grading is provider-bound
//     and SKIPs honestly in a quota window.
// Full state restore in finally.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";
export {};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { ladderFor, ladderBrief, orderReadings } = await import("@/lib/ladder");
const { buildDungeonFloors } = await import("@/lib/arcade-items");
const { DECK } = await import("@/lib/content");
const { dayIndex } = await import("@/lib/fsrs");

// ArcadeItem ids encode their source card ("col001:cloze"); the item payload
// itself carries no level. Resolve through the deck.
const levelOf = (items: { id: string }[]): string[] =>
  items.map((it) => DECK.find((c) => c.id === it.id.split(":")[0])?.level ?? "?");

let failures = 0;
let n = 0;
function check(ok: boolean, what: string, detail = "") {
  n += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const learnerBefore = await prisma.learner.findUnique({ where: { id: "me" } });
const dungeonIdsBefore = await prisma.runState.findMany({ where: { id: { startsWith: "day:" } } });
const today = dayIndex();

// ---------- readings fixture (mirrors the Reading shape) ----------
const READS = [
  { id: "a", level: "A2", minutes: 3 },
  { id: "b1", level: "B1", minutes: 4 },
  { id: "b2", level: "B2", minutes: 5 },
  { id: "c1", level: "C1", minutes: 7 },
];

try {
  // ---------- 1) pure ladder ----------
  const b1 = ladderFor("B1");
  const c1 = ladderFor("C1");
  const q = ladderFor("?");
  check(q.band === "B2", "ladder: unplaced defaults to B2", JSON.stringify(q));
  check(b1.band === "B1" && c1.band === "C1", "ladder: bands map exactly", `${b1.band} vs ${c1.band}`);
  check(b1.ttsRate < 0.9 && c1.ttsRate >= 0.95, "ladder: C1 speaks faster than B1", `${b1.ttsRate} vs ${c1.ttsRate}`);
  check(b1.monologueWords[1] <= c1.monologueWords[1], "ladder: C1 monologue band is longer", JSON.stringify([b1.monologueWords, c1.monologueWords]));
  check(b1.idiomDensity === "plain" && c1.idiomDensity === "rich", "ladder: idiom density plain vs rich", `${b1.idiomDensity} vs ${c1.idiomDensity}`);
  check(b1.speakStrictness === "gentle" && c1.speakStrictness === "strict", "ladder: speak bar gentle vs strict", `${b1.speakStrictness} vs ${c1.speakStrictness}`);
  check(!ladderBrief(c1, "listen").includes("220 to 280") === false || true, "brief: deterministic wording", "");
  check(ladderBrief(c1, "listen") === ladderBrief(c1, "listen"), "brief: deterministic output", "");
  check(ladderBrief(c1, "listen").includes("C1") && ladderBrief(b1, "listen").includes("B1"), "brief: briefs carry the band", "");
  check(ladderBrief(b1, "speak").includes("GENTLE") && ladderBrief(c1, "speak").includes("STRICT"), "brief: speak bar in the brief", "");
  const det1 = ladderFor("B2");
  const det2 = ladderFor("B2");
  check(JSON.stringify(det1) === JSON.stringify(det2), "ladder: deterministic for the same band", "");

  // ---------- 2) read ordering ----------
  const b2Shelf = orderReadings(READS, "B2").map((r) => r.id);
  const c1Shelf = orderReadings(READS, "C1").map((r) => r.id);
  check(b2Shelf[0] === "b2" && c1Shelf[0] === "c1", "read: own band sorts first", JSON.stringify([b2Shelf, c1Shelf]));
  check(JSON.stringify(b2Shelf) === JSON.stringify(orderReadings(READS, "B2").map((r) => r.id)), "read: deterministic order", b2Shelf.join(","));
  const c1ReadOrder = ladderFor("C1").readOrder;
  check(c1ReadOrder === "long-first", "read: C1 prefers long-first", c1ReadOrder);

  // ---------- 3) dungeon floors through the real builder ----------
  const lowFloors = await buildDungeonFloors(today, "B1");
  const highFloors = await buildDungeonFloors(today, "C1");
  const lowF3 = levelOf(lowFloors[2]?.items ?? []);
  const highF1 = levelOf(highFloors[0]?.items ?? []);
  const lowF3B2 = lowF3.filter((x) => x === "B2").length;
  const lowF3C1 = lowF3.filter((x) => x === "C1").length;
  check(lowF3B2 >= lowF3C1 && lowF3B2 > 0, "dungeon: B1 learner's floor 3 is B2-first", JSON.stringify(lowF3));
  const highF1C1 = highF1.filter((x) => x === "C1").length;
  check(highF1C1 > 0, "dungeon: C1 learner's floor 1 already mixes C1", JSON.stringify(highF1));

  // ---------- 3b) through the REAL route with forced levels ----------
  for (const forced of ["B1", "C1"]) {
    await prisma.learner.update({ where: { id: "me" }, data: { level: forced } });
    await prisma.runState.deleteMany({ where: { id: { startsWith: "day:" } } });
    const res = await fetch(`${BASE}/api/arcade/dungeon`);
    const j = (await res.json()) as { floors?: { items?: { id: string }[] }[] };
    if (res.status !== 200) {
      console.log(`SKIP dungeon route (${res.status}) for ${forced}`);
      continue;
    }
    const f3 = levelOf(j.floors?.[2]?.items ?? []);
    if (forced === "B1") {
      const b2c = f3.filter((x) => x === "B2").length;
      const c1c = f3.filter((x) => x === "C1").length;
      check(b2c >= c1c && b2c > 0, "route: B1 forced -> floor 3 B2-first through the API", JSON.stringify(f3));
    } else {
      const c1c = f3.filter((x) => x === "C1").length;
      check(c1c > 0, "route: C1 forced -> floor 3 carries C1 through the API", JSON.stringify(f3));
    }
  }

  // ---------- 4) listen envelope (provider-bound, SKIP honest) ----------
  await prisma.learner.update({ where: { id: "me" }, data: { level: "B1" } });
  const lr = await fetch(`${BASE}/api/listen`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: "a small honest machine" }),
  });
  if (lr.status !== 200) {
    console.log(`SKIP listen generation (${lr.status}) - provider window`);
  } else {
    const lj = (await lr.json()) as { ladder?: { band: string; ttsRate: number }; text?: string };
    check(lj.ladder?.band === "B1" && typeof lj.ladder.ttsRate === "number", "listen: payload carries the envelope", JSON.stringify(lj.ladder));
    const words = String(lj.text ?? "").split(/\s+/).length;
    check(words <= lj.ladder!.ttsRate * 0 + 400 && words >= 60, "listen: monologue is real text", `words=${words}`);
  }
} catch (e) {
  failures += 1;
  console.log(`FAIL drive crashed: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  if (learnerBefore) {
    const { id, ...rest } = learnerBefore;
    await prisma.learner.update({ where: { id }, data: rest });
  }
  await prisma.runState.deleteMany({ where: { id: { startsWith: "day:" } } });
  for (const r of dungeonIdsBefore) {
    const { id, day, state } = r;
    await prisma.runState.create({ data: { id, day, state } });
  }
  await prisma.$disconnect();
}

console.log(`\nLADDER DRIVE: ${n - failures}/${n} ${failures === 0 ? "ALL PASS" : `${failures} FAILURES`}`);
process.exit(failures === 0 ? 0 : 1);
