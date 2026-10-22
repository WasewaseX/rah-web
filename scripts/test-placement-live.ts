/**
 * Live drive of /api/placement: start -> answer through all sections ->
 * writing -> done. Verifies per-delivery choice shuffling, embedded reading
 * passages, key + trap label on a miss, and the diagnostic fold: misses land
 * in mistake-memory families (placement:*), the done response carries the
 * trap summary, and a healed family sharing the tag is reopened.
 * EVERYTHING the drive touches is restored afterwards so the user's real
 * placement result, level, daily stats and mistake families are intact.
 */
import { db } from "../src/lib/db";
import { PLACEMENT_ITEMS } from "../src/lib/content";
import { dayIndex } from "../src/lib/fsrs";

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
const placementBefore = await db.placement.findUnique({ where: { userId_id: { userId: "me", id: "main" } } });
const familiesBefore = await db.mistakeFamily.findMany();

// Healed families the drive's tags should reopen: proof the diagnostic counts
// as relapse evidence for every family sharing the tag. c5 (word_choice) and
// r2 (fluency_illusion) are both guaranteed to be asked on this answer path.
await db.mistakeFamily.create({
  data: {
    id: "chat:word_choice",
    kind: "chat",
    tag: "word_choice",
    label: "Word choice",
    count: 3,
    evidence: "seed -> seed",
    streakClean: 2,
    resolvedAt: new Date(),
  },
});
await db.mistakeFamily.create({
  data: {
    id: "chat:fluency_illusion",
    kind: "chat",
    tag: "fluency_illusion",
    label: "Fluency illusion",
    count: 2,
    evidence: "seed -> seed",
    streakClean: 2,
    resolvedAt: new Date(),
  },
});

const dailyBefore = await db.dailyStat.findUnique({ where: { userId_day: { userId: "me", day: dayIndex() } } } );

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
    // miss on purpose: every c5 and r2 encountered (both are on this path)
    const missOnPurpose = item.id === "c5" || item.id === "r2";
    const choice = missOnPurpose ? item.choices.find((c) => c !== item.a)! : item.a;
    const ar = await fetch(`${BASE}/api/placement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", itemId: item.id, choice }),
    });
    const aj: { correct: boolean; key?: string; trapLabel?: string; phase: string; item?: { id: string } | null } = await ar.json();
    if (!aj.correct) {
      if (!wrongFeedback) wrongFeedback = aj;
      if (!wrongOnReading) wrongOnReading = item.sec === "reading";
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
  check(wrongOnReading || !!wrongFeedback, "miss feedback captured", "");

  // Writing: submit so the diagnostic fold runs. A live AI call grades it.
  const wr = await fetch(`${BASE}/api/placement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "writing",
      text: "In my opinion money can buy comfort but not happiness. For example last year I bought a new phone and I was happy for two days, after that it was just a phone. Real happiness for me is time with my family, when we travel together or cook dinner. My friend has a lot of money but he works all the time and he is always tired, so I think money is a tool, not a goal.",
    }),
  });
  const doneRaw = await wr.json();
  const done = doneRaw as {
    phase: string;
    level?: string;
    traps?: { tag: string; label: string; count: number }[];
  } | null;
  check(
    wr.ok && !!done && done.phase === "done",
    "writing submission completes placement",
    done ? JSON.stringify(done).slice(0, 120) : `HTTP ${wr.status} empty/error body`,
  );
  if (!done) throw new Error("placement writing action returned no body - cannot continue the done-phase checks");

  const tags = (done.traps ?? []).map((t) => t.tag);
  check(tags.includes("word_choice"), "done response carries word_choice in trap summary", JSON.stringify(done.traps ?? []));
  check(tags.includes("fluency_illusion"), "done response carries fluency_illusion in trap summary", JSON.stringify(done.traps ?? []));
  check(
    (done.traps ?? []).every((t) => typeof t.label === "string" && t.label.length > 0 && t.count >= 1),
    "every trap in the summary has a human label and count",
    JSON.stringify(done.traps ?? []),
  );

  const fam1 = await db.mistakeFamily.findUnique({ where: { id: "placement:word_choice" } });
  const fam2 = await db.mistakeFamily.findUnique({ where: { id: "placement:fluency_illusion" } });
  check(!!fam1 && fam1.count >= 1, "placement:word_choice family created", JSON.stringify(fam1 ?? {}));
  check(!!fam2 && fam2.count >= 1, "placement:fluency_illusion family created", JSON.stringify(fam2 ?? {}));
  check(!!fam1 && fam1.evidence.includes(" -> "), "family evidence carries the miss", fam1?.evidence ?? "none");

  const reopened = await db.mistakeFamily.findUnique({ where: { id: "chat:word_choice" } });
  check(!!reopened && reopened.resolvedAt === null, "healed chat:word_choice reopened by the placement miss", JSON.stringify(reopened ?? {}));
  const reopened2 = await db.mistakeFamily.findUnique({ where: { id: "chat:fluency_illusion" } });
  check(!!reopened2 && reopened2.resolvedAt === null, "healed chat:fluency_illusion reopened by the placement miss", JSON.stringify(reopened2 ?? {}));

  // The steering path: state profile must now carry the placement families.
  const st = (await (await fetch(`${BASE}/api/state`, { cache: "no-store" })).json()) as {
    profile?: { mistakes?: { tag: string }[] };
  };
  const profileTags = (st.profile?.mistakes ?? []).map((m) => m.tag);
  check(
    profileTags.includes("word_choice") || profileTags.includes("fluency_illusion"),
    "state profile steers with the placement traps",
    JSON.stringify(profileTags),
  );
} finally {
  // Restore EVERYTHING the drive touched.
  await db.mistakeFamily.deleteMany({ where: { id: { notIn: familiesBefore.map((f) => f.id) } } });
  for (const f of familiesBefore) {
    await db.mistakeFamily.update({
      where: { id: f.id },
      data: {
        count: f.count,
        evidence: f.evidence,
        lastSeen: f.lastSeen,
        streakClean: f.streakClean,
        resolvedAt: f.resolvedAt,
      },
    });
  }
  await db.placement.deleteMany({ where: { userId: "me", id: "main" } });
  if (placementBefore) {
    await db.placement.create({ data: placementBefore });
  }
  if (learnerBefore) {
    await db.learner.update({
      where: { id: "me" },
      data: { placementPhase: learnerBefore.placementPhase, level: learnerBefore.level },
    });
  }
  if (dailyBefore) {
    await db.dailyStat.update({
      where: { userId_day: { userId: "me", day: dailyBefore.day } },
      data: {
        reviews: dailyBefore.reviews,
        correct: dailyBefore.correct,
        xp: dailyBefore.xp,
        spoken: dailyBefore.spoken,
        written: dailyBefore.written,
        listened: dailyBefore.listened,
      },
    });
  }
  console.log("placement + mistake families + daily stats restored");
}

console.log(failures === 0 ? "\nPLACEMENT LIVE: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
