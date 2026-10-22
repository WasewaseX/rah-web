/**
 * Task 80 — flag regression checks: unit battery for the pure checker.
 * Run: bun scripts/test-flag-regressions.ts
 */
import { checkCardIntegrity, regressionLine, FLAG_KINDS } from "../src/lib/flag-regressions";
import { cardById } from "../src/lib/content";

let pass = 0, fail = 0;
const check = (ok: boolean, what: string, detail = "") => {
  if (ok) { pass++; console.log(`PASS ${what}`); }
  else { fail++; console.log(`FAIL ${what} -> ${detail}`); }
};

const healthy = cardById("col001") ?? null;
check(healthy !== null, "a real bank card resolves", "pick any bank id");

if (healthy) {
  const r1 = checkCardIntegrity(healthy, { cardId: healthy.id, kind: "typo", note: "", status: "open" });
  check(r1.ok, "healthy bank card passes its regression", r1.problems.join("; "));

  // A "fixed" typo flag must STILL pass: the fixed state is pinned, not assumed.
  const r2 = checkCardIntegrity(healthy, { cardId: healthy.id, kind: "typo", note: "was a typo, fixed", status: "fixed" });
  check(r2.ok, "fixed flag on healthy card stays green (the regression pin)", JSON.stringify(r2.problems));

  // A broken card shape fails loudly.
  const broken = { ...healthy, answer: "" };
  const r3 = checkCardIntegrity(broken, { cardId: healthy.id, kind: "wrong-answer", note: "", status: "open" });
  check(!r3.ok && r3.problems.some((p) => p.includes("answer is empty")), "empty answer fails the integrity check", JSON.stringify(r3.problems));

  // Distractor == answer is unanswerable as an MCQ.
  const trap = { ...healthy, distractors: [healthy.answer, "decoy"] };
  const r4 = checkCardIntegrity(trap, { cardId: healthy.id, kind: "unclear", note: "", status: "open" });
  check(!r4.ok && r4.problems.some((p) => p.includes("distractor equals the answer")), "distractor-equals-answer is caught", JSON.stringify(r4.problems));
}

// A flag whose card vanished cannot be verified - honest failure, not a fake pass.
const ghost = checkCardIntegrity(null, { cardId: "gone-card", kind: "other", note: "", status: "fixed" });
check(!ghost.ok && ghost.problems[0].includes("not found"), "missing card is an honest failure (a fixed flag on a deleted card reopens)", ghost.problems[0]);

// The wrong-answer kind gets its own targeted check when accepts disagree.
const mismatch = healthy ? { ...healthy, alt: ["something else"] } : null;
if (mismatch) {
  const r5 = checkCardIntegrity(mismatch, { cardId: mismatch.id, kind: "wrong-answer", note: "", status: "open" });
  check(r5.problems.some((p) => p.includes("accepts list does not contain") || p.includes("still does not accept")), "wrong-answer flag catches an accepts/answer mismatch", JSON.stringify(r5.problems));
}

// The runner line is readable and carries status + verdict.
const line = regressionLine({ cardId: "x", kind: "typo", note: "", status: "fixed" }, { ok: false, problems: ["answer is empty"] });
check(line.startsWith("[fixed]") && line.includes("FAIL") && line.includes("answer is empty"), "regressionLine carries status, verdict, problems", line);

check(FLAG_KINDS.length === 5, "flag taxonomy pinned (5 kinds)");

console.log(`\n=== FLAG REGRESSION BATTERY: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
