// Controlled single-sequence probe: fixed review schedule, print both
// engines' intermediates step by step to localize the formula divergence.

import { review, defaultState, W, retrievability, nextDifficulty, s0, d0 } from "../src/lib/fsrs";
import { fsrs, generatorParameters, createEmptyCard, type Grade } from "ts-fsrs";

const RETENTION = 0.9;
const DAY_MS = 86400000;
const refLong = fsrs(generatorParameters({ w: W, request_retention: RETENTION, enable_short_term: false }));

// Fixed schedule: (grade, gapInDays)
const SCHEDULE: [number, number][] = [
  [3, 0],   // new, Good, same day as creation
  [2, 15],  // Hard after 15 days
  [3, 17],  // Good after 17 days
  [4, 31],  // Easy after 31 days
  [1, 10],  // Again after 10 days
  [3, 5],   // Good after 5 days
];

let day = 20000;
let ours = defaultState();
let card = createEmptyCard(new Date(day * DAY_MS));

console.log(`W = ${JSON.stringify(W)}`);
console.log(`s0(1..4) = ${[1, 2, 3, 4].map((g) => s0(g).toFixed(5)).join(", ")}`);
console.log(`d0(1..4) = ${[1, 2, 3, 4].map((g) => d0(g).toFixed(5)).join(", ")}`);

for (let i = 0; i < SCHEDULE.length; i++) {
  const [grade, gap] = SCHEDULE[i];
  day += gap;
  const now = new Date(day * DAY_MS);

  const preOurs = { ...ours };
  const preCard = { ...card };
  const r = preOurs.state !== "new" && preOurs.s > 0 ? retrievability(day - preOurs.last, preOurs.s) : NaN;
  const nd = preOurs.state !== "new" && preOurs.s > 0 ? nextDifficulty(preOurs.d, grade) : NaN;

  const o = review(ours, grade, day, RETENTION);
  const t = refLong.next(card, now, grade as Grade).card;

  console.log(
    `step ${i + 1} g=${grade} gap=${gap}: PRE ours(s=${preOurs.s.toFixed(6)} d=${preOurs.d.toFixed(6)} last=${preOurs.last}) r=${Number.isNaN(r) ? "-" : r.toFixed(6)} nd=${Number.isNaN(nd) ? "-" : nd.toFixed(6)} | ref(s=${preCard.stability.toFixed(6)} d=${preCard.difficulty.toFixed(6)} el=${preCard.elapsed_days})`,
  );
  console.log(
    `          POST ours(s=${o.fsrs.s.toFixed(6)} d=${o.fsrs.d.toFixed(6)} ivl=${o.ivl}) | ref(s=${t.stability.toFixed(6)} d=${t.difficulty.toFixed(6)} sched=${t.scheduled_days.toFixed(6)} el=${t.elapsed_days})`,
  );

  ours = o.fsrs;
  card = t;
}
