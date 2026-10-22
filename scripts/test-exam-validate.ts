/**
 * Task 81 — distractor quality gate: unit battery.
 * Run: bun scripts/test-exam-validate.ts
 */
import { distractorQuality, repairChoices } from "../src/lib/agent/exam-gate";

let pass = 0, fail = 0;
const check = (ok: boolean, what: string, detail = "") => {
  if (ok) { pass++; console.log(`PASS ${what}`); }
  else { fail++; console.log(`FAIL ${what} -> ${detail}`); }
};

const KEY = "has lived";

// 1. healthy set passes
check(distractorQuality(["has lived", "has live", "has been living", "was living"], KEY).ok, "healthy distractor set passes");

// 2. duplicate choices fail
check(!distractorQuality(["has lived", "has lived", "was living", "was living"], KEY).ok, "duplicate choices fail");

// 3. empty choice fails
check(!distractorQuality(["has lived", "", "was living", "  "], KEY).ok, "empty choice fails");

// 4. fewer than 2 REAL distractors (rest are the key) fails
check(!distractorQuality(["has lived", "Has Lived", "HAS LIVED", "was living"], KEY).ok, "key-clone distractors leave <2 real distractors");

// 5. shape-plausibility: a wildly long distractor against a short key with no shared words fails
check(!distractorQuality(["has lived", "deliberating extensively regarding several interconnected matters", "x", "y"], KEY).ok, "shape giveaway fails the plausibility heuristic");

// 6. repair trims and dedupes while preserving order and the key
const repaired = repairChoices(["  has lived ", "has lived", "was living", "", "has been living"]);
check(JSON.stringify(repaired) === JSON.stringify(["has lived", "was living", "has been living"]), "repair trims, dedupes, drops empties, keeps order", JSON.stringify(repaired));

// 7. repair + gate: a once-duplicated set becomes healthy after repair
const once = repairChoices(["has lived", "has lived", "was living", "has been living"]);
check(distractorQuality(once, KEY).ok, "repair then gate turns a duplicate set healthy");

// 8. shared-word plausibility: short but topically-shaped distractor passes
check(distractorQuality(["has lived", "has gone", "did", "went"], KEY).ok, "shared-word distractors pass even at different lengths");

console.log(`\n=== DISTRACTOR GATE BATTERY: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
