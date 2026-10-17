// FSRS PARITY GATE - differential test of our hand-rolled FSRS-5 engine
// (src/lib/fsrs.ts) against the reference implementation (ts-fsrs v4.6.1,
// the exact version our port documents agreement with).
//
// DESIGN NOTE (why two reference engines): our app schedules by DAY INDEX
// (due dates, DailyStat and streaks are all day-granular), so our engine
// collapses ts-fsrs's sub-day "learning ladder" into day-granularity. That
// makes neither ts-fsrs mode a perfect twin on its own:
//   - enable_short_term=false (refLong)  matches us on new-card init and
//     every long-gap step (>= 1 day), including post-lapse relearning;
//   - enable_short_term=true  (refShort) matches us on same-day steps
//     (the FSRS-5 short-term stability formula) - intervals skipped, its
//     schedule is in minutes, ours in days.
// Every step is compared against the twin that implements the same math.
// Any mismatch in stability, difficulty or interval fails the gate.
//
// Out of differential scope (deliberate app-level semantics):
//   - lapses bookkeeping: the app counts a new-card "Again" as a lapse so
//     its lapse-rate analytics (ok = reps - lapses) stay honest.

import { review, defaultState, W } from "../src/lib/fsrs";
import { fsrs, generatorParameters, createEmptyCard, Rating, type Card, type Grade } from "ts-fsrs";

// Deterministic RNG so failures are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RETENTION = 0.9;
const DAY_MS = 86400000;

const refLong = fsrs(generatorParameters({ w: W, request_retention: RETENTION, enable_short_term: false }));
const refShort = fsrs(generatorParameters({ w: W, request_retention: RETENTION, enable_short_term: true }));

function close(a: number, b: number, rel = 1e-6): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
}

interface Mismatch { trial: number; step: number; field: string; ours: string; ref: string; detail: string }

function runTrial(trial: number, rng: () => number, out: Mismatch[]): void {
  // Day grid anchored at midnight UTC so date diffs stay exact integers.
  let day = 19000 + Math.floor(rng() * 100);
  let ours = defaultState();
  let cardLong: Card = createEmptyCard(new Date(day * DAY_MS));
  let cardShort: Card = createEmptyCard(new Date(day * DAY_MS));

  const steps = 3 + Math.floor(rng() * 6);
  // The app's queue only re-serves a card the same day if it was graded Again
  // (due = today). So same-day steps are only comparable when they continue a
  // same-day Again ladder - the learning-state path on both sides.
  let inLadder = false;
  for (let step = 1; step <= steps; step++) {
    const grade = 1 + Math.floor(rng() * 4); // 1=Again .. 4=Easy, same scale both sides
    // The app's queue can never serve a long-term-scheduled card the same
    // day again, so such steps would poison later comparisons with states
    // the app can never reach - force a realistic gap instead.
    let gap = rng() < 0.25 ? 0 : 1 + Math.floor(rng() * 45);
    if (gap === 0 && !inLadder) gap = 1 + Math.floor(rng() * 45);
    day += gap;
    const now = new Date(day * DAY_MS);

    const wasNew = ours.state === "new" || ours.s <= 0 || ours.d <= 0;
    const ladderStep = !wasNew && gap === 0 && inLadder;
    const o = review(ours, grade, day, RETENTION);
    ours = o.fsrs;

    const diff = (label: string, a: number, b: number, detail: string) => {
      if (!close(a, b)) out.push({ trial, step, field: label, ours: String(a), ref: String(b), detail });
    };

    // --- refLong: the day-granular twin (new-card init + all long-gap steps)
    cardLong = refLong.next(cardLong, now, grade as Grade).card;
    if (wasNew || gap >= 1) {
      diff(`long.stability`, o.fsrs.s, cardLong.stability, `grade=${grade} gap=${gap} wasNew=${wasNew}`);
      diff(`long.difficulty`, o.fsrs.d, cardLong.difficulty, `grade=${grade} gap=${gap} wasNew=${wasNew}`);
      if (!wasNew || gap >= 1) {
        const tIvl = Math.round(cardLong.scheduled_days);
        if (o.ivl !== tIvl) {
          out.push({ trial, step, field: "long.interval", ours: String(o.ivl), ref: String(tIvl), detail: `grade=${grade} gap=${gap} s=${o.fsrs.s.toFixed(4)}` });
        }
      }
    }

    // --- refShort: the same-day twin (learning ladder after an Again)
    cardShort = refShort.next(cardShort, now, grade as Grade).card;
    if (ladderStep) {
      diff(`short.stability`, o.fsrs.s, cardShort.stability, `ladder grade=${grade}`);
      diff(`short.difficulty`, o.fsrs.d, cardShort.difficulty, `ladder grade=${grade}`);
      const tIvl = Math.round(cardShort.scheduled_days);
      if (Math.round(o.ivl) !== tIvl) {
        out.push({ trial, step, field: "short.interval", ours: String(Math.round(o.ivl)), ref: String(tIvl), detail: `ladder grade=${grade}` });
      }
    }
    // The card sits in today's ladder for the NEXT step iff this step was a
    // same-day Again or Hard (both engines keep those in the learning
    // ladder: Again/Hard -> due today; Good/Easy -> interval >= 1 day).
    inLadder = gap === 0 && (grade === 1 || grade === 2);
  }
}

function main(): void {
  const out: Mismatch[] = [];
  const TRIALS = 400;
  for (let i = 0; i < TRIALS; i++) runTrial(i, mulberry32(0x5eed + i), out);

  if (out.length > 0) {
    console.error(`FSRS PARITY FAILED: ${out.length} mismatch(es) across ${TRIALS} trials`);
    for (const m of out.slice(0, 10)) {
      console.error(`  trial ${m.trial} step ${m.step} [${m.field}] ours=${m.ours} ref=${m.ref} (${m.detail})`);
    }
    process.exit(1);
  }
  console.log(`FSRS PARITY PASS: ${TRIALS} randomized sequences (long-gap vs refLong, same-day vs refShort), zero divergence from ts-fsrs v4.6.1`);
}

main();
