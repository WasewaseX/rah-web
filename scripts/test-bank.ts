// D2 word-bank translate drive (DUOLINGO-RE.md) - live over the real app.
//
// Claim set:
//  1. Pure engine: bankTiles is deterministic per (card, day), always
//     contains every target word with full multiplicity (the answer is
//     always buildable), never duplicates a tile, caps the tray, and tops
//     up thin distractor fields from the deck so hollow cards can never
//     render a degenerate tray.
//  2. Day seed matters: trays change across days (fresh exercise, no
//     memorized tile order).
//  3. Live route: /api/review/queue attaches tiles to bank items only, and
//     the same card renders the same tray within a day.
//  4. Grading wire: a bank-card grade through the REAL grade route persists
//     dir="bank", advances FSRS state, writes a ReviewLog row.
//  5. Client grading parity: the join-and-normalize check the Review view
//     performs accepts the target build and rejects a decoy build.
// Full state restore in finally - the drive leaves no residue.

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/custom.db";
const BASE = "http://localhost:3000";
export {};

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { bankTiles } = await import("@/lib/bank");
const { DECK } = await import("@/lib/content");
const { dayIndex } = await import("@/lib/fsrs");

let failures = 0;
let passes = 0;
function check(ok: boolean, what: string, detail = ""): void {
  if (ok) passes += 1;
  else failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${ok ? "" : ` -> ${detail}`}`);
}

const today = dayIndex();

// Cards the drive forces into the audio slot so the queue serves bank items
// (rotation: cloze -> reverse -> fa2en -> audio -> bank). Snapshotted +
// restored in finally.
const FORCED = DECK.filter((c) => c.kind === "cloze").slice(0, 8).map((c) => c.id);
let forcedBefore: Record<string, unknown>[] = [];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- snapshot for restore ----------
const learnerBefore = await prisma.learner.findUnique({ where: { id: "me" } });
const statBefore = await prisma.dailyStat.findUnique({ where: { userId_day: { userId: "me", day: today } } } );
let gradedCardId: string | null = null;
let gradedStateBefore: Record<string, unknown> | null = null;
let gradedLogIdsBefore: number[] = [];

try {
  // ---------- 1+2: pure engine ----------
  let determinismHolds = true;
  let completenessHolds = true;
  let capHolds = true;
  let multHolds = true;
  let dayShift = 0;
  for (const card of DECK) {
    const a = bankTiles(card, today);
    const b = bankTiles(card, today);
    if (JSON.stringify(a) !== JSON.stringify(b)) determinismHolds = false;
    const lower = a.map((w) => w.toLowerCase());
    // duplicates are legitimate ONLY when the target itself repeats a word;
    // distractors are deduped against everything by the builder.
    const target = card.en.split(/\s+/).filter(Boolean);
    const mult = new Map<string, number>();
    for (const w of target) mult.set(w.toLowerCase(), (mult.get(w.toLowerCase()) ?? 0) + 1);
    const counts = new Map<string, number>();
    for (const w of lower) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (const [w, n] of counts) {
      if (n > Math.max(mult.get(w) ?? 0, 1)) multHolds = false;
    }
    for (const w of target) {
      const need = mult.get(w.toLowerCase()) ?? 0;
      const have = counts.get(w.toLowerCase()) ?? 0;
      if (have < need) completenessHolds = false;
    }
    if (a.length > 14) capHolds = false;
    const c = bankTiles(card, today + 1);
    if (JSON.stringify(a) !== JSON.stringify(c)) dayShift += 1;
  }
  check(determinismHolds, `bankTiles deterministic per (card, day) over all ${DECK.length} cards`);
  check(completenessHolds, "every target word present with full multiplicity (answer always buildable)");
  check(multHolds, "no duplicate tiles");
  check(capHolds, "tray capped at 14 tiles");
  check(dayShift >= DECK.length - 5, `day seed reshuffles the tray (${dayShift}/${DECK.length} cards differ across days)`);

  const hollow = DECK.filter((c) => (c.distractors ?? []).length === 0);
  const hollowOk = hollow.every((c) => {
    const target = c.en.split(/\s+/).filter(Boolean);
    return bankTiles(c, today).length >= target.length + 5;
  });
  check(hollowOk, `hollow distractor fields topped up from the deck (${hollow.length} cards)`);

  // ---------- 3: live queue route ----------
  // Force 8 cloze cards into the audio slot (lowest-retention state wins the
  // sort, so they always make the batch slice) so the rotation serves bank.
  forcedBefore = await prisma.cardState.findMany({ where: { cardId: { in: FORCED } } });
  for (const id of FORCED) {
    await prisma.cardState.upsert({
      where: { userId_cardId: { userId: "me", cardId: id } },
      create: { cardId: id, s: 0.1, d: 5, due: today, last: today - 365, lapses: 1, reps: 5, state: "review", lastivl: 1, dir: "audio" },
      update: { s: 0.1, d: 5, due: today, last: today - 365, lapses: 1, reps: 5, state: "review", lastivl: 1, dir: "audio" },
    });
  }
  const batches: any[] = [];
  for (let i = 0; i < 3; i++) {
    const resp = await fetch(`${BASE}/api/review/queue`, { cache: "no-store" });
    batches.push(await resp.json());
  }
  const bankItems = batches.flatMap((j) => (j.batch ?? []).filter((x: any) => x.dir === "bank"));
  const tilesOnlyOnBank = batches.every((j) =>
    (j.batch ?? []).every((x: any) => (x.dir === "bank" ? Array.isArray(x.tiles) && x.tiles.length > 0 : JSON.stringify(x.tiles ?? []) === "[]")),
  );
  const forcedServed = batches.some((j) => (j.batch ?? []).some((x: any) => FORCED.includes(x.card?.id) && x.dir === "bank"));
  check(forcedServed, "forced cards rotate audio -> bank and reach the batch");
  check(bankItems.length > 0, `queue serves bank items (${bankItems.length} across 3 batches)`);
  check(tilesOnlyOnBank, "tiles attached to bank items only");

  let wireDeterminism = true;
  for (const item of bankItems) {
    for (const other of bankItems.filter((x: any) => x.card.id === item.card.id)) {
      if (JSON.stringify(item.tiles) !== JSON.stringify(other.tiles)) wireDeterminism = false;
    }
  }
  check(wireDeterminism, "same card, same day -> identical tray over the wire");
  const trayOk = bankItems.every((x: any) => {
    const target = x.card.en.split(/\s+/).filter(Boolean);
    return x.tiles.length >= target.length + 5;
  });
  check(trayOk, "every wired tray carries the target plus noise");

  // ---------- 4: grading wire ----------
  const pick = bankItems[0];
  if (!pick) {
    check(false, "grading wire", "no bank item to grade");
  } else {
    const cardId: string = pick.card.id;
    gradedCardId = cardId;
    gradedStateBefore = await prisma.cardState.findUnique({ where: { userId_cardId: { userId: "me", cardId } } });
    gradedLogIdsBefore = (
      await prisma.reviewLog.findMany({ where: { cardId }, select: { id: true } })
    ).map((r) => r.id);

    const gr = await fetch(`${BASE}/api/review/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, grade: 3, dir: "bank" }),
    });
    check(gr.ok, "grade route accepts a bank outcome", `status ${gr.status}`);
    const gj = await gr.json();
    check(typeof gj.ivl === "number", "FSRS interval returned");

    const st = await prisma.cardState.findUnique({ where: { userId_cardId: { userId: "me", cardId } } });
    check(st?.dir === "bank", "CardState.dir persisted as bank", `dir=${st?.dir}`);
    check((st?.reps ?? 0) === (((gradedStateBefore as any)?.reps ?? 0) + 1), "FSRS reps advanced");
    const newLogs = await prisma.reviewLog.findMany({ where: { cardId } });
    check(newLogs.some((r) => !gradedLogIdsBefore.includes(r.id)), "ReviewLog row written");

    // ---------- 5: client grading parity ----------
    const seq: number[] = [];
    for (const w of pick.card.en.split(/\s+/)) {
      const i = pick.tiles.findIndex((t: string, k: number) => t.toLowerCase() === w.toLowerCase() && !seq.includes(k));
      if (i >= 0) seq.push(i);
    }
    const targetBuild = seq.map((i) => pick.tiles[i]).join(" ");
    check(normalize(targetBuild) === normalize(pick.card.en), "correct tap sequence builds the target");
    const decoy = pick.tiles.filter((_: string, i: number) => !seq.includes(i));
    if (decoy.length > 0) {
      check(normalize(`${targetBuild} ${decoy[0]}`) !== normalize(pick.card.en), "extra tile breaks the match");
    }
  }
} finally {
  // ---------- full restore ----------
  try {
    if (gradedCardId) {
      // the graded card was forced first, so its ORIGINAL row (if any) lives
      // in forcedBefore; gradedStateBefore only captured the forced state.
      const snap = forcedBefore.find((r) => (r as any).cardId === gradedCardId) ?? gradedStateBefore;
      if (snap) {
        const s = snap as Record<string, never>;
        await prisma.cardState.upsert({ where: { userId_cardId: { userId: "me", cardId: gradedCardId } }, create: { ...s } as never, update: { ...s } as never });
      } else {
        await prisma.cardState.deleteMany({ where: { userId: "me", cardId: gradedCardId } });
      }
      const logs = await prisma.reviewLog.findMany({ where: { cardId: gradedCardId } });
      for (const row of logs) {
        if (!gradedLogIdsBefore.includes(row.id)) await prisma.reviewLog.delete({ where: { id: row.id } });
      }
    }
    // restore the cards the drive forced into the audio slot
    for (const id of FORCED) {
      if (gradedCardId === id) continue; // already restored above
      const snap = forcedBefore.find((r) => (r as any).cardId === id);
      if (snap) {
        const s = snap as Record<string, never>;
        await prisma.cardState.upsert({ where: { userId_cardId: { userId: "me", cardId: id } }, create: { ...s } as never, update: { ...s } as never });
      } else {
        await prisma.cardState.deleteMany({ where: { userId: "me", cardId: id } });
      }
    }
    if (learnerBefore) {
      const l = learnerBefore as unknown as Record<string, never>;
      await prisma.learner.update({ where: { id: "me" }, data: { ...l } as never });
    }
    if (statBefore) {
      const st = statBefore as unknown as Record<string, never>;
      await prisma.dailyStat.update({ where: { userId_day: { userId: "me", day: today } }, data: { ...st } as never });
    } else {
      await prisma.dailyStat.deleteMany({ where: { userId: "me", day: today } });
    }
  } catch (e) {
    console.error(`RESTORE FAILED: ${String(e).slice(0, 200)}`);
    failures += 1;
  }
}

console.log(failures > 0 ? `BANK DRIVE FAILED (${failures})` : `BANK DRIVE ${passes}/${passes + failures} ALL PASS`);
process.exit(failures > 0 ? 1 : 0);
