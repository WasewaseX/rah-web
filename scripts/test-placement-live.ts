/**
 * Live drive of /api/placement: start -> answer through all sections ->
 * writing. Verifies per-delivery choice shuffling, embedded reading passages,
 * and that a miss now returns the key + human trap label. Restores the
 * learner's placement state afterwards so the user's real result is intact.
 */
import { db } from "../src/lib/db";
import { PLACEMENT_ITEMS } from "../src/lib/content";

const BASE = "http://localhost:3000";
let failures = 0;
function check(ok: boolean, name: string, detail = "") {
  if (ok) console.log(`PASS ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name} -> ${detail}`);
  }
}

const learnerBefore = await db.learner.findUnique({ where: { id: "me" } });
const placementBefore = await db.placement.findUnique({ where: { id: "main" } });

try {
  const r = await fetch(`${BASE}/api/placement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start" }),
  });
  let j: {
    phase: string;
    sec?: string;
    item?: { id: string; q: string; choices: string[] } | null;
  } = await r.json();
  check(j.phase === "quiz", "start returns quiz", JSON.stringify(j).slice(0, 80));

  let steps = 0;
  let sawReading = false;
  let sawShuffle = false;
  let wrongFeedback: { key?: string; trapLabel?: string } | null = null;
  let wrongOnReading = false;

  while (j.phase === "quiz" && j.item && steps < 40) {
    const item = PLACEMENT_ITEMS.find((i) => i.id === j.item!.id)!;
    // shuffle check: delivered order differs from static order at least once
    if (item.choices.join("|") !== j.item.choices.join("|")) sawShuffle = true;
    if (item.sec === "reading") {
      sawReading = true;
      check(j.item.q.includes("\n\n"), `reading item ${item.id} delivers embedded passage`, j.item.q.slice(0, 60));
    }
    // miss on purpose: c5 once, r2 once; everything else correct
    const missOnPurpose = (item.id === "c5" || item.id === "r2") && !wrongFeedback;
    const choice = missOnPurpose ? item.choices.find((c) => c !== item.a)! : item.a;
    const ar = await fetch(`${BASE}/api/placement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", itemId: item.id, choice }),
    });
    const aj: { correct: boolean; key?: string; trapLabel?: string; phase: string; item?: { id: string } | null } = await ar.json();
    if (!aj.correct) {
      wrongFeedback = aj;
      wrongOnReading = item.sec === "reading";
      check(typeof aj.key === "string" && aj.key === item.a, `miss on ${item.id} returns the key`, JSON.stringify(aj).slice(0, 100));
      check(typeof aj.trapLabel === "string" && aj.trapLabel.length > 0, `miss on ${item.id} returns a trap label`, String(aj.trapLabel));
    }
    if (aj.phase === "writing") {
      j = { phase: "writing" };
      break;
    }
    j = aj as unknown as typeof j;
    steps++;
  }
  check(steps >= 15, "walked the full quiz", `${steps} steps`);
  check(sawShuffle, "delivered choices were shuffled at least once");
  check(sawReading, "reading section was reached", JSON.stringify(j).slice(0, 80));
  check(!!wrongFeedback, "a deliberate miss was exercised", "");
  check(wrongOnReading || wrongFeedback, "miss feedback captured", "");

  // writing phase reachable; do NOT submit (would overwrite the user's level)
} finally {
  // Restore the user's real placement state.
  await db.placement.deleteMany({ where: { id: "main" } });
  if (placementBefore) {
    await db.placement.create({ data: placementBefore });
  }
  if (learnerBefore) {
    await db.learner.update({
      where: { id: "me" },
      data: { placementPhase: learnerBefore.placementPhase, level: learnerBefore.level },
    });
  }
  console.log("placement state restored");
}

console.log(failures === 0 ? "\nPLACEMENT LIVE: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
