// Fuzzy grader self-test: the exact failure cases the learner reported.
import { gradeAnswer, similarity, containsPattern } from "../src/lib/agent/fuzzy";

const cases: [string, Parameters<typeof gradeAnswer>[0] | boolean, boolean][] = [
  ["exact match", { given: "call off", type: "cloze", a: "call off" }, true],
  ["extra article", { given: "take the advantage of", type: "cloze", a: "take advantage of" }, true],
  ["synonym rain", { given: "pouring rain", type: "cloze", a: "heavy rain", accept: ["pouring rain", "driving rain"] }, true],
  ["inflection rains", { given: "rains", type: "cloze", a: "rain" }, true],
  ["wrong answer", { given: "do a decision", type: "cloze", a: "make a decision" }, false],
  ["case+punct", { given: "  Call Off!  ", type: "cloze", a: "call off" }, true],
  ["rewrite uses target", { given: "We should take advantage of the situation", type: "rewrite", a: "We should take advantage of the situation", mustInclude: ["take advantage of"] }, true],
  ["rewrite with filler", { given: "Honestly, you should really take advantage of this offer while it lasts.", type: "rewrite", a: "Take advantage of this offer.", mustInclude: ["take advantage of"] }, true],
  ["rewrite missing target", { given: "You should use this offer.", type: "rewrite", a: "Take advantage of this offer.", mustInclude: ["take advantage of"] }, false],
  ["mcq exact", { given: "postpone", type: "mcq", a: "postpone", choices: ["postpone", "cancel"] }, true],
  ["mcq wrong", { given: "cancel", type: "mcq", a: "postpone", choices: ["postpone", "cancel"] }, false],
  ["raise vs address", { given: "raise", type: "cloze", a: "address", accept: ["tackle", "deal with", "address"] }, false],
  ["address accepted", { given: "tackle", type: "cloze", a: "address", accept: ["tackle", "deal with"] }, true],
  ["blank", { given: "", type: "cloze", a: "anything" }, false],
  ["containment", containsPattern("you must take the advantage of it", "take advantage of"), true],
];

let pass = 0;
let fail = 0;
for (const [name, input, expected] of cases) {
  const got = typeof input === "boolean" ? input : gradeAnswer(input as Parameters<typeof gradeAnswer>[0]);
  const ok = got === expected;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} (got ${got}, want ${expected})`);
}
console.log(`\n${pass}/${pass + fail} passed`);
console.log("similarity check:", similarity("take the advantage of the situation", "take advantage of situation"));
if (fail > 0) process.exit(1);
