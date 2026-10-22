/**
 * Task 77 — writing rubric history (criterion-level deltas across revision
 * chains): unit battery for the pure helper exported by the writing route.
 *
 *  1. two graded ends -> exact deltas (first vs LAST of the chain)
 *  2. rounding to one decimal
 *  3. single graded end -> honest unlock note, empty criteria
 *  4. zero graded results -> same honesty
 *  5. middle submissions do not distort the end-to-end delta
 *  6. a DECLINE renders as a negative delta (the instrument must show it)
 *
 * Run: bun scripts/test-writing-rubric.ts
 */
import { rubricHistory } from "../src/app/api/writing/route";

type Sub = { result: { scores: { task: number; organization: number; range: number; accuracy: number } } | null };

function sub(scores: [number, number, number, number] | null): Sub {
  return { result: scores ? { scores: { task: scores[0], organization: scores[1], range: scores[2], accuracy: scores[3] } } : null };
}

let pass = 0, fail = 0;
function check(ok: boolean, what: string, detail = "") {
  if (ok) { pass++; console.log(`PASS ${what}`); }
  else { fail++; console.log(`FAIL ${what} -> ${detail}`); }
}

// 1 + 2. two graded ends: exact deltas, one-decimal rounding
const r1 = rubricHistory([sub([6, 5, 7, 6.55]), sub([7, 5.5, 7, 6])]);
check(r1 !== null && r1.criteria.length === 4, "two graded ends -> 4 criteria");
check(r1!.criteria.find((c) => c.key === "task")?.delta === 1, "task delta exact (6->7 = +1)", JSON.stringify(r1!.criteria));
check(r1!.criteria.find((c) => c.key === "organization")?.delta === 0.5, "organization delta rounded to one decimal (5->5.5)");
check(r1!.criteria.find((c) => c.key === "accuracy")?.delta === -0.5, "accuracy decline shows as a NEGATIVE delta (6.55->6)");
check(r1!.criteria.every((c) => Math.abs(c.delta - Math.round((c.last - c.first) * 10) / 10) < 1e-9), "every delta equals the ONE-DECIMAL-rounded last-first (the instrument rounds deliberately)");

// 3. single graded end -> honest note
const r2 = rubricHistory([sub([6, 5, 7, 6]), sub(null)]);
check(r2!.criteria.length === 0 && /two graded drafts/i.test(r2!.note), "one graded end -> unlock note, no invented numbers");

// 4. nothing graded
const r3 = rubricHistory([sub(null), sub(null)]);
check(r3!.criteria.length === 0, "zero graded ends -> empty criteria");
check(r3!.note.length > 10, "zero graded ends -> note present");

// 5. middle submissions do not distort end-to-end (first vs LAST, not max/min)
const r4 = rubricHistory([sub([4, 4, 4, 4]), sub([9, 9, 9, 9]), sub([5, 4.5, 4, 4.5])]);
check(r4!.criteria.find((c) => c.key === "task")?.delta === 1, "middle spike ignored: task 4->5 = +1 (not 4->9)");
check(r4!.criteria.find((c) => c.key === "range")?.delta === 0, "range 4->4 = 0");

// 6. decline stays negative end-to-end even if the last draft is below the first
const r5 = rubricHistory([sub([8, 8, 8, 8]), sub([6.5, 7, 7, 7])]);
check(r5!.criteria.every((c) => c.delta < 0 || (c.key === "organization" && c.delta === -1)), "declining chain renders negative deltas", JSON.stringify(r5!.criteria));

console.log(`\n=== WRITING RUBRIC BATTERY: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
