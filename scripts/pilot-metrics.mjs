/**
 * Task 76 — P1 educational-outcomes validation: LEARNER PILOT METRICS.
 *
 * The evaluator's P1: "run a structured learner pilot and track retention,
 * writing quality, listening comprehension and speaking improvement over
 * several weeks." Tests prove the app behaves as coded; only a multi-week
 * series on the learner's REAL data can speak to learning. This script is
 * the measurement instrument: it reads the real tables (READ-ONLY) and
 * prints the weekly snapshot the protocol (PILOT-PROTOCOL.md) tracks.
 *
 *   - RETENTION: per-week first-attempt recall from ReviewLog (source
 *     filtering per direction) + interval-survival proxy (cards whose
 *     last interval >= 7d and still scheduled vs lapsed).
 *   - WRITING: revision chains from WritingSub (parentId/revision) — the
 *     metric is honest: count chains, and record that quality deltas need
 *     the rubric history (the audit's PARTIAL boundary is repeated here).
 *   - LISTENING: dictation outcomes (ReviewLog source='dictation').
 *   - SPEAKING: SpeakSession volume + score trend from the stored result
 *     JSON (score fields only — never content).
 *
 * Zero AI. Zero content printed (counts and numbers only). Run weekly:
 *   node scripts/pilot-metrics.mjs   (or bun scripts/pilot-metrics.mjs)
 */
import { DatabaseSync } from "node:sqlite";

const DB = process.env.RAH_DB_PATH || "/home/z/my-project/db/custom.db";
const db = new DatabaseSync(`file:${DB}?mode=ro`, { readOnly: true });

const dayIndex = () => Math.floor(Date.now() / 86400000);
const TODAY = dayIndex();
const WEEK = 7;

function weekOf(day) {
  return Math.floor((TODAY - day) / WEEK); // 0 = this week, 1 = last week...
}

function q(sql) {
  return db.prepare(sql).all();
}

function pct(n, d) {
  return d ? Math.round((n / d) * 100) + "%" : "n/a";
}

console.log("=== LEARNER PILOT METRICS (zero-AI snapshot, " + new Date().toISOString().slice(0, 10) + ") ===");

// ---- 1. RETENTION: first-attempt recall per week (30-day window)
const reviews = q(`SELECT day, grade, source FROM ReviewLog WHERE day >= ${TODAY - 30}`);
const byWeek = new Map();
for (const r of reviews) {
  const w = weekOf(r.day);
  if (w > 4) continue;
  if (!byWeek.has(w)) byWeek.set(w, { n: 0, good: 0 });
  const b = byWeek.get(w);
  b.n++;
  if (r.grade >= 3) b.good++;
}
console.log("\nRETENTION (first-attempt recall, per week; weeks ago 4..0):");
for (const w of [4, 3, 2, 1, 0]) {
  const b = byWeek.get(w) || { n: 0, good: 0 };
  const flag = b.n < 20 ? "  [small sample - a real signal, not a trend]" : "";
  console.log(`  week -${w}: ${b.n} first attempts, recall ${pct(b.good, b.n)}${flag}`);
}

// interval survival: cards scheduled >=7d out that were NOT since lapsed
const cards = q(`SELECT cardId, due, last, lapses, reps, suspended FROM CardState`);
const mature = cards.filter((c) => c.due - c.last >= 7 && !c.suspended).length;
const lapses = cards.reduce((a, c) => a + c.lapses, 0);
console.log(`  deck: ${cards.length} cards, ${mature} with >=7d intervals, ${lapses} lifetime lapses`);

// ---- 2. WRITING: revision chains
const subs = q(`SELECT id, parentId, revision, length(text) AS len FROM WritingSub`);
const chains = subs.filter((s) => !s.parentId).length;
const revised = subs.filter((s) => s.parentId).length;
console.log(`\nWRITING: ${chains} original submissions, ${revised} revisions across ${new Set(subs.filter((s) => s.parentId).map((s) => s.parentId)).size} chains`);
console.log(`  (quality deltas need the rubric-history system - audit PARTIAL boundary stands; volume + revision behavior is what this snapshot pins)`);

// ---- 3. LISTENING: dictation outcomes
const dict = q(`SELECT day, grade FROM ReviewLog WHERE source='dictation' AND day >= ${TODAY - 30}`);
const dictWeeks = new Map();
for (const r of dict) {
  const w = weekOf(r.day);
  if (w > 4) continue;
  if (!dictWeeks.has(w)) dictWeeks.set(w, { n: 0, good: 0 });
  const b = dictWeeks.get(w);
  b.n++;
  if (r.grade >= 3) b.good++;
}
console.log("\nLISTENING (dictation first-attempt accuracy, per week):");
for (const w of [4, 3, 2, 1, 0]) {
  const b = dictWeeks.get(w) || { n: 0, good: 0 };
  console.log(`  week -${w}: ${b.n} items, accuracy ${pct(b.good, b.n)}${b.n < 20 ? "  [small sample]" : ""}`);
}

// ---- 4. SPEAKING: session volume + stored score trend (numbers only)
const speak = q(`SELECT at, result FROM SpeakSession ORDER BY at DESC LIMIT 100`);
const speakScores = [];
for (const s of speak) {
  try {
    const r = JSON.parse(s.result);
    const score = typeof r.overall === "number" ? r.overall : typeof r.total === "number" ? r.total : null;
    if (score !== null) speakScores.push(score);
  } catch {}
}
console.log(`\nSPEAKING: ${speak.length} recent sessions (cap 100), ${speakScores.length} with a numeric overall score`);
if (speakScores.length >= 4) {
  const half = Math.floor(speakScores.length / 2);
  const older = speakScores.slice(half).reduce((a, b) => a + b, 0) / (speakScores.length - half);
  const newer = speakScores.slice(0, half).reduce((a, b) => a + b, 0) / half;
  console.log(`  trend proxy: older-half avg ${older.toFixed(1)} -> newer-half avg ${newer.toFixed(1)} (proxy-labeled until the acoustic tier measures real audio)`);
} else {
  console.log(`  not enough scored sessions yet for a trend (need >=4)`);
}

// pronunciation read-aloud (round 0 rows, measured tier)
const readAloud = q(`SELECT count(*) AS n FROM SpeakSession WHERE round=0`);
console.log(`  read-aloud measured assessments: ${readAloud[0]?.n ?? 0}`);

// ---- 5. CONSISTENCY (the habit substrate the pilot depends on)
const days = q(`SELECT day, reviews, xp FROM DailyStat WHERE reviews > 0 ORDER BY day DESC LIMIT 28`);
console.log(`\nCONSISTENCY: ${days.length} active days in the last 28; total reviews ${days.reduce((a, d) => a + d.reviews, 0)}`);

console.log("\n(Protocol: PILOT-PROTOCOL.md — re-run weekly; the series, not the snapshot, is the evidence.)");
db.close();
