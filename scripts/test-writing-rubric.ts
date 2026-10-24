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
import { rubricHistory, revisionChanges } from "../src/app/api/writing/route";

type Sub = { revision: number; result: { scores: { task: number; organization: number; range: number; accuracy: number }; errors?: { bad: string; good: string }[] } | null };

function sub(scores: [number, number, number, number] | null, revision = 1): Sub {
  return { revision, result: scores ? { scores: { task: scores[0], organization: scores[1], range: scores[2], accuracy: scores[3] } } : null };
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

// ---- Task 83: revision change summaries
const err = (bad: string, good: string) => ({ bad, good });
const chain = [
  { revision: 1, result: { scores: { task: 6, organization: 5, range: 7, accuracy: 6 }, errors: [err("I am very disappoint", "I am very disappointed"), err("in the internet", "on the internet"), err("since two years", "for two years")] } },
  { revision: 2, result: { scores: { task: 7, organization: 5.5, range: 7, accuracy: 7 }, errors: [err("in the internet", "on the internet"), err("more better", "better")] } },
];
const ch = revisionChanges(chain);
check(ch.length === 1, "one adjacent graded pair -> one change row", JSON.stringify(ch));
check(ch[0].fixed === 2, "fixed = flagged before and gone now (2)", JSON.stringify(ch[0]));
check(ch[0].remaining === 1, "remaining = still flagged (1)");
check(ch[0].introduced === 1, "introduced = new flags (1)");
check(ch[0].fixedExamples.length === 2 && ch[0].fixedExamples.includes("I am very disappointed"), "fixedExamples carry the GOOD replacements", JSON.stringify(ch[0].fixedExamples));

// ungraded submissions are skipped, not treated as clean revisions
const chain2 = [
  chain[0],
  { revision: 2, result: null },
  chain[1],
];
check(revisionChanges(chain2).length === 1, "ungraded revisions are skipped (they carry no error list)");

// a chain with no errors anywhere produces a zero-row (no invented fixes)
const chain3 = [
  { revision: 1, result: { scores: { task: 6, organization: 5, range: 7, accuracy: 6 }, errors: [] } },
  { revision: 2, result: { scores: { task: 6, organization: 5, range: 7, accuracy: 6 }, errors: [] } },
];
const ch3 = revisionChanges(chain3);
check(ch3.length === 1 && ch3[0].fixed === 0 && ch3[0].introduced === 0, "clean pair -> honest zero row");

// --- Task 94: writing-draft autosave store (device-local, honesty-pinned) ---
import { WRITE_DRAFT_KEY, clearWriteDraft, loadWriteDraft, saveWriteDraft } from "../src/lib/write-draft";

function fakeStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    _m: m,
  };
}

check(loadWriteDraft(null) === null, "null storage -> no draft, no throw");
check(loadWriteDraft(fakeStore()) === null, "empty storage -> no draft");

const s1 = fakeStore();
check(saveWriteDraft({ text: "My draft text.", goalSel: "exam", revisingId: null, at: 100 }, s1), "save returns true");
check(s1._m.get(WRITE_DRAFT_KEY)?.includes("My draft text.") === true, "draft persisted under the canonical key");

const l1 = loadWriteDraft(s1);
check(l1 !== null && l1.text === "My draft text." && l1.goalSel === "exam" && l1.revisingId === null && l1.at === 100, "round-trip preserves every field");

// empty text is NOT a draft: saving it clears, loading returns null
const s2 = fakeStore();
saveWriteDraft({ text: "x", goalSel: "", revisingId: null, at: 1 }, s2);
check(saveWriteDraft({ text: "   ", goalSel: "", revisingId: null, at: 2 }, s2), "saving whitespace-only clears (returns true)");
check(loadWriteDraft(s2) === null, "empty draft -> load returns null (nothing to restore)");
check(!s2._m.has(WRITE_DRAFT_KEY), "empty save removed the key");

// corrupt payloads ignored, never thrown
const s3 = fakeStore();
s3._m.set(WRITE_DRAFT_KEY, "{not json");
check(loadWriteDraft(s3) === null, "corrupt JSON -> null, no throw");
s3._m.set(WRITE_DRAFT_KEY, JSON.stringify({ text: 42, goalSel: 7 }));
check(loadWriteDraft(s3) === null, "wrong-shape payload -> null, no throw");
s3._m.set(WRITE_DRAFT_KEY, JSON.stringify({ text: "ok", goalSel: 7, revisingId: "junk", at: "x" }));
const l3 = loadWriteDraft(s3);
check(l3 !== null && l3.text === "ok" && l3.goalSel === "" && l3.revisingId === null && l3.at === 0, "partial-shape payload -> sanitized draft");

// clearing removes the key; a junk revisingId is dropped, not preserved
const s4 = fakeStore();
saveWriteDraft({ text: "keep", goalSel: "", revisingId: 9, at: 5 }, s4);
check(clearWriteDraft(s4) && !s4._m.has(WRITE_DRAFT_KEY), "clear removes the key");
check(clearWriteDraft(null) === false, "clear with null storage -> false, no throw");

console.log(`\n=== WRITING RUBRIC BATTERY: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
