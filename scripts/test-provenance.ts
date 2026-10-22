/**
 * Task 79 — evidence-backed reference provenance: unit battery.
 * Run: bun scripts/test-provenance.ts
 */
import { provenanceOf } from "../src/lib/provenance";

let pass = 0, fail = 0;
const check = (ok: boolean, what: string, detail = "") => {
  if (ok) { pass++; console.log(`PASS ${what}`); }
  else { fail++; console.log(`FAIL ${what} -> ${detail}`); }
};

const bank = provenanceOf("awl_c1_07");
check(bank.label.includes("course bank"), "bank card names the authored bank", bank.label);
check(/not generated/i.test(bank.detail), "bank provenance says NOT generated at read time", bank.detail);

const mat = provenanceOf("mat:abc123");
check(mat.label.includes("your material"), "material card says 'your material'", mat.label);
check(/exact source/i.test(mat.detail), "material provenance promises the exact source line", mat.detail);

const exam = provenanceOf("exam:collocation");
check(exam.label.includes("your own misses"), "exam-derived card says 'from your own misses'", exam.label);
const listen = provenanceOf("listen:th-stress");
check(listen.label.includes("your own misses"), "listen-derived card says 'from your own misses'", listen.label);

check(provenanceOf("unknown-prefix").label.includes("course bank"), "unknown ids default to the bank honestly");

console.log(`\n=== PROVENANCE BATTERY: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
