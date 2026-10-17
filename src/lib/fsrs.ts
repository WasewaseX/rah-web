// FSRS-5 scheduler, ported from crates/rah-core/src/fsrs.rs and verified by
// scripts/test-fsrs-parity.ts against the reference implementation
// (ts-fsrs v4.6.1, the exact version these formulas follow):
//   - recall/forget stability take the PRE-REVIEW difficulty (ts-fsrs feeds
//     the old D into (11 - D); the updated D only becomes the card's state);
//   - post-lapse stability is clamp(preS, S_MIN, S_forget) - the long-term
//     scheduler rule; the app schedules by day, never in minutes.
// Grades: 1=Again 2=Hard 3=Good 4=Easy.

export const W: number[] = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
export const DECAY = -0.5;
export const FACTOR = 19 / 81;
export const S_MIN = 0.1;
export const S_MAX = 36500.0;
export const MAX_IVL = 36500;

export interface FsrsState {
  s: number;
  d: number;
  due: number;
  last: number;
  lapses: number;
  reps: number;
  state: string;
  lastivl: number;
}

export function defaultState(): FsrsState {
  return { s: 0, d: 0, due: 0, last: -1, lapses: 0, reps: 0, state: "new", lastivl: 0 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function s0(grade: number): number {
  const i = clamp(grade, 1, 4) - 1;
  const v = W[i];
  return v < S_MIN ? S_MIN : v;
}

export function d0(grade: number): number {
  const i = clamp(grade, 1, 4);
  const v = W[4] - Math.exp(W[5] * (i - 1)) + 1.0;
  return clamp(v, 1.0, 10.0);
}

export function retrievability(tDays: number, s: number): number {
  const t = tDays < 0 ? 0 : tDays;
  return Math.pow(1.0 + (FACTOR * t) / s, DECAY);
}

export function intervalFor(s: number, retention: number): number {
  const ivl = (s / FACTOR) * (Math.pow(retention, 1.0 / DECAY) - 1.0);
  return Math.floor(ivl + 0.5) < 1 ? 1 : Math.min(MAX_IVL, Math.floor(ivl + 0.5));
}

export function nextDifficulty(d: number, grade: number): number {
  const dd = -W[6] * (grade - 3.0);
  const damped = d + (dd * (10.0 - d)) / 9.0;
  const target = d0(4);
  const reverted = W[7] * target + (1.0 - W[7]) * damped;
  return clamp(reverted, 1.0, 10.0);
}

export function recallStability(s: number, d: number, r: number, grade: number): number {
  const hard = grade === 2 ? W[15] : 1.0;
  const easy = grade === 4 ? W[16] : 1.0;
  const term =
    Math.exp(W[8]) *
    (11.0 - d) *
    Math.pow(s, -W[9]) *
    Math.expm1(W[10] * (1.0 - r)) *
    hard *
    easy;
  return clamp(s * (1.0 + term), S_MIN, S_MAX);
}

export function lapseStability(s: number, d: number, r: number): number {
  const sf =
    W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1.0, W[13]) - 1.0) * Math.exp(W[14] * (1.0 - r));
  // Reference (ts-fsrs v4.6.1 long-term scheduler, class B.next_ds):
  //   stability_after_again = clamp(preStability, S_MIN, forgetStability)
  // The forgotten card cannot come back MORE stable than it was.
  return Math.min(Math.max(s, S_MIN), sf);
}

export function sameDayStability(s: number, grade: number): number {
  return clamp(s * Math.exp(W[17] * (grade - 3.0 + W[18])), S_MIN, S_MAX);
}

export interface ReviewOutcome {
  fsrs: FsrsState;
  ivl: number;
  due: number;
}

// Reference interval ordering (ts-fsrs v4.6.1 scheduler next_interval):
// Again <= Hard <= Good <= Easy with a minimum one-day gap between neighbors.
function orderConstrain(base: number[]): [number, number, number, number] {
  const out = [base[0]];
  for (let i = 1; i < 4; i++) out[i] = Math.max(base[i], out[i - 1] + 1);
  return out as [number, number, number, number];
}

// Apply one review. `day` is the day index (days since epoch, UTC),
// `retention` the desired retention in 0..1.
export function review(state: FsrsState, grade: number, day: number, retention: number): ReviewOutcome {
  const g = clamp(Math.round(grade), 1, 4);
  const fs: FsrsState = { ...state, reps: state.reps + 1, last: day };
  const isNew = state.state === "new" || state.s <= 0.0 || state.d <= 0.0;

  if (isNew) {
    const ns = s0(g);
    const nd = d0(g);
    // Reference (class B.newState): all four grade intervals are computed,
    // then order-constrained - a new Hard never schedules shorter than a
    // new Again plus one day, and so on up the ladder.
    const chain = orderConstrain([1, 2, 3, 4].map((i) => intervalFor(s0(i), retention)));
    const ivl = chain[g - 1];
    fs.s = ns;
    fs.d = nd;
    fs.due = day + ivl;
    fs.state = "review";
    fs.lastivl = ivl;
    if (g === 1) fs.lapses += 1;
    return { fsrs: fs, ivl, due: fs.due };
  }

  const t = day - state.last;
  const nd = nextDifficulty(state.d, g);

  if (t < 1) {
    // Same-day re-reviews only occur in the post-Again learning ladder
    // (a graded card leaves today's queue otherwise). Reference: ts-fsrs
    // short-term scheduler, learningState transitions.
    const ns = sameDayStability(state.s, g);
    fs.s = ns;
    fs.d = nd;
    fs.state = "review";
    if (g === 1 || g === 2) {
      // Again (+5 min) / Hard (+10 min) stay in today's relearning queue;
      // in day-granular form that is due = today, interval 0.
      if (g === 1) fs.lapses += 1;
      fs.due = day;
      fs.lastivl = 0;
      return { fsrs: fs, ivl: 0, due: day };
    }
    // Good exits the ladder; Easy must clear a Good-graded card by a day.
    const ivl =
      g === 4
        ? Math.max(intervalFor(ns, retention), intervalFor(sameDayStability(state.s, 3), retention) + 1)
        : intervalFor(ns, retention);
    fs.due = day + ivl;
    fs.lastivl = ivl;
    return { fsrs: fs, ivl, due: fs.due };
  }

  const r = retrievability(t, state.s);
  // Reference semantics: the stability formulas consume the PRE-review
  // difficulty (state.d), not the just-updated one (nd). All four candidate
  // stabilities are computed, their intervals order-constrained, and the
  // graded one is kept - exactly like the reference scheduler.
  const sAgain = lapseStability(state.s, state.d, r);
  const sHard = recallStability(state.s, state.d, r, 2);
  const sGood = recallStability(state.s, state.d, r, 3);
  const sEasy = recallStability(state.s, state.d, r, 4);
  const ns = g === 1 ? sAgain : g === 2 ? sHard : g === 3 ? sGood : sEasy;
  const chain = orderConstrain(
    [sAgain, sHard, sGood, sEasy].map((s) => intervalFor(s, retention)),
  );
  const ivl = chain[g - 1];
  fs.s = ns;
  fs.d = nd;
  fs.due = day + ivl;
  fs.state = "review";
  fs.lastivl = ivl;
  return { fsrs: fs, ivl, due: fs.due };
}

// Preview the four intervals without mutating.
export function preview(state: FsrsState, day: number, retention: number): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) out[i] = review(state, i + 1, day, retention).ivl;
  return out;
}

export function cardR(state: FsrsState, day: number): number {
  if (state.state === "new" || state.last < 0 || state.s <= 0.0) return 0.0;
  const t = Math.max(0, day - state.last);
  return retrievability(t, state.s);
}

// Day index in UTC days since epoch.
export function dayIndex(now = Date.now()): number {
  return Math.floor(now / 86400000);
}

export function fmtIvl(ivl: number): string {
  if (ivl <= 0) return "today";
  if (ivl === 1) return "1d";
  if (ivl < 30) return `${ivl}d`;
  if (ivl < 360) return `${Math.round((ivl / 30) * 10) / 10}mo`;
  return `${Math.round((ivl / 360) * 10) / 10}y`;
}
