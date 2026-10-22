// Learner-memory corrections + tombstone semantics (Task 65).
// Runs against a THROWAWAY database with explicit userIds - no request
// context, no live data. Run:
//   DATABASE_URL=file:/home/z/my-project/db/battery-memory.db bun scripts/test-memory.ts
// (push the schema first: bunx prisma db push --skip-generate with that URL)

process.env.DATABASE_URL ||= "file:/home/z/my-project/db/battery-memory.db";
export {}; // top-level await needs a module

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const { recordMistakes, correctFamily, forgetFamily, topMistakes } = await import("../src/lib/mistakes");
const { noteTagOutcome } = await import("../src/lib/mastery");

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

await prisma.mistakeFamily.deleteMany();
await prisma.mistakeForgiven.deleteMany();
await prisma.tagMastery.deleteMany();

// 1. recording is per-user: same kind:tag key, two users, no collision
await recordMistakes([{ kind: "chat", tag: "statives", wrong: "I am agree", right: "I agree" }], "u1");
await recordMistakes([{ kind: "chat", tag: "statives", wrong: "B slip", right: "B fix" }], "u2");
const u1 = await topMistakes(10, false, "u1");
const u2 = await topMistakes(10, false, "u2");
check(u1.length === 1 && u2.length === 1, "same tag aggregates per user, not globally", JSON.stringify({ u1: u1.length, u2: u2.length }));
check(u1[0].id === "u1:chat:statives" && u2[0].id === "u2:chat:statives", "family ids are userId-prefixed", `${u1[0].id} ${u2[0].id}`);
check(u1[0].evidence.includes("I am agree") && !u1[0].evidence.includes("B slip"), "u1 sees only u1 evidence", u1[0].evidence);

// 2. forget: family leaves AND the exact pair is tombstoned
const foe = await forgetFamily("u1:chat:statives", "u2");
check(!foe.ok, "cross-user forget is refused", JSON.stringify(foe));
const gone = await forgetFamily("u1:chat:statives", "u1");
check(gone.ok, "owner forget succeeds", JSON.stringify(gone));
check((await topMistakes(10, false, "u1")).length === 0, "family left the memory");
const tombs = await prisma.mistakeForgiven.findMany();
check(tombs.length === 1 && tombs[0].userId === "u1" && tombs[0].evidenceHash.length === 40, "tombstone recorded with evidence hash", JSON.stringify(tombs.map((t) => t.userId)));

// 3. the SAME rejected pair must not resurrect; NEW evidence reopens
await recordMistakes([{ kind: "chat", tag: "statives", wrong: "I am agree", right: "I agree" }], "u1");
check((await topMistakes(10, false, "u1")).length === 0, "tombstoned identical pair does not re-aggregate");
await recordMistakes([{ kind: "chat", tag: "statives", wrong: "She is know him", right: "She knows him" }], "u1");
const revived = await topMistakes(10, false, "u1");
check(revived.length === 1 && revived[0].evidence.includes("She is know"), "genuinely new evidence reopens the family", JSON.stringify(revived[0]?.evidence));

// 4. correction: the learner fixes the quote; editedAt provenance is set
const bad = await correctFamily("u1:chat:statives", { label: "" }, "u1");
check(!bad.ok, "empty label is rejected", JSON.stringify(bad));
const noev = await correctFamily("u1:chat:statives", { evidence: "no arrow here" }, "u1");
check(!noev.ok, "evidence without -> is rejected", JSON.stringify(noev));
const foreign = await correctFamily("u1:chat:statives", { label: "hacked" }, "u2");
check(!foreign.ok, "cross-user correction is refused", JSON.stringify(foreign));
const fix = await correctFamily("u1:chat:statives", { label: "Stative verbs (edited)", evidence: "She is know him -> She knows him (fixed quote)" }, "u1");
check(fix.ok, "owner correction succeeds", JSON.stringify(fix));
const after = await topMistakes(10, false, "u1");
check(after[0].label === "Stative verbs (edited)" && after[0].editedAt !== null, "corrected row carries new label + editedAt", JSON.stringify(after[0]));

// 5. exam healing stays scoped: u1's clean hits never touch u2's families
await noteTagOutcome("statives", false, "u1");
await noteTagOutcome("statives", true, "u2");
const led1 = await prisma.tagMastery.findUnique({ where: { userId_tag: { userId: "u1", tag: "statives" } } });
const led2 = await prisma.tagMastery.findUnique({ where: { userId_tag: { userId: "u2", tag: "statives" } } });
check(led1?.no === 1 && led2?.ok === 1, "mastery ledger rows are per-user", JSON.stringify({ led1, led2 }));

await prisma.$disconnect();
console.log(`\nmemory battery: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
