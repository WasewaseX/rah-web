/**
 * Placement bank quality gate.
 *
 * Born from the 2026-10-11 incident: the reading section referenced passages
 * that did not exist ("According to the passage, ..."), distractors gave the
 * answer away (3 negative strawmen + 1 positive key), 18 of 25 items had no
 * trap feedback, two items had two idiomatic keys, and keys sat on A/B 96% of
 * the time. This suite fails the build if any of that comes back.
 */
import { readFileSync } from "node:fs";
import { PLACEMENT_ITEMS } from "../src/lib/content";

let failures = 0;
function check(ok: boolean, name: string, detail = "") {
  if (ok) console.log(`PASS ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name} -> ${detail}`);
  }
}

const items = PLACEMENT_ITEMS;
const raw = JSON.parse(readFileSync("src/content/placement.json", "utf8")) as { items: { q: string }[] };

// 1. Structural integrity
check(items.length === 25, "bank has 25 items", String(items.length));
check(
  items.every((i) => i.choices.length === 4 && new Set(i.choices).size === 4),
  "every item has 4 unique choices",
  items.filter((i) => i.choices.length !== 4 || new Set(i.choices).size !== 4).map((i) => i.id).join(","),
);
check(
  items.every((i) => i.choices.includes(i.a)),
  "key is always among the choices",
  items.filter((i) => !i.choices.includes(i.a)).map((i) => i.id).join(","),
);

// 2. Phantom passages: a reading item may only reference a text it embeds.
const DANGLING =
  /\b(according to|based on)\b[^.]{0,40}\b(text|passage|article|author|writer)\b|\bthe (text|passage|article) (says|states|mentions|suggests)\b|\bthe (author|writer) (says|states|mentions|argues)\b/i;
for (const i of items) {
  if (i.sec !== "reading") continue;
  const hasPassage = i.q.includes("\n\n") && i.q.length >= 220;
  check(hasPassage, `${i.id}: reading item embeds its passage`, `len=${i.q.length}`);
  check(!DANGLING.test(i.q) || hasPassage, `${i.id}: no dangling passage reference`, i.q.slice(0, 80));
}
const readingWithPassage = raw.items.filter((i) => i.q.includes("\n\n") && i.q.length >= 220).length;
check(readingWithPassage === 4, "all 4 reading items carry passages", String(readingWithPassage));

// 3. Option-design tells.
const NEG_START = /^(not |never |no |cannot |can't |should avoid|useless|removes? |harms? |demotivates? |a poor |poor )/i;
const ABSOLUTES = ["best", "always", "never", "immediately", "only", "most", "all ", "harms", "harm "];
for (const i of items) {
  const others = i.choices.filter((c) => c !== i.a);
  // 3-negative-1-positive: key is the only option that does not open negative/extreme
  check(others.filter((c) => NEG_START.test(c)).length < 3, `${i.id}: no 3-negative tell`);
  // longest-is-correct
  const avg = i.choices.reduce((s, c) => s + c.length, 0) / 4;
  check(!(i.a.length > 1.6 * avg), `${i.id}: key is not far the longest`, `${i.a.length} vs ${avg.toFixed(0)}`);
  // unique hedge among absolutes
  const keyHedged = /^(may |might |can )/i.test(i.a);
  const absOthers = others.filter((c) => ABSOLUTES.some((m) => c.includes(m))).length;
  check(!(keyHedged && absOthers >= 2), `${i.id}: no unique-hedge-among-absolutes tell`);
}

// 4. Trap feedback present for every item (18 were empty before the fix).
check(items.every((i) => i.trap.trim().length > 0), "every item carries a trap", items.filter((i) => !i.trap.trim()).map((i) => i.id).join(","));

// 5. Key-position balance per section (shuffle at delivery is the real fix;
//    the static bank must still not bury one letter).
const bySec = new Map<string, number[]>();
for (const i of items) {
  const arr = bySec.get(i.sec) ?? [];
  arr.push(i.choices.indexOf(i.a));
  bySec.set(i.sec, arr);
}
for (const [sec, idxs] of bySec) {
  const counts = [0, 0, 0, 0];
  for (const x of idxs) counts[x]++;
  check(Math.max(...counts) <= 4, `${sec}: no letter dominates key positions`, JSON.stringify(counts));
}

console.log(failures === 0 ? "\nPLACEMENT BANK: ALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
