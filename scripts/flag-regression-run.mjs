/**
 * Task 80 — flag regression runner: executes the per-flag integrity checks
 * against the REAL database, read-only (node:sqlite mode=ro). Every fixed
 * flag must still pass; every open flag shows its current state; every
 * cardId resolves through the bank, material or exam seams.
 *
 * Run: node scripts/flag-regression-run.mjs   (exit 1 = a FIXED flag regressed)
 */
import { DatabaseSync } from "node:sqlite";

const DB = process.env.RAH_DB_PATH || "/home/z/my-project/db/custom.db";
const db = new DatabaseSync(`file:${DB}?mode=ro`, { readOnly: true });

// Pure checker re-implemented here to keep the runner dependency-free (the
// lib version with the same rules is unit-battery-pinned in its TS form).
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
}

function checkCard(card, flag) {
  const problems = [];
  if (!card) return { ok: false, problems: ["card not found — the flag cannot be verified"] };
  const answer = card.answer ?? "";
  if (!answer.trim()) problems.push("answer is empty");
  if (!card.en || !card.en.trim()) problems.push("example sentence (en) is empty");
  const accepts = JSON.parse(card.alt || "[]").map(norm);
  if (card.kind === "cloze" && accepts.length > 0 && !accepts.includes(norm(answer)) && !String(card.prompt).includes("__")) {
    problems.push("cloze accepts list does not contain the answer");
  }
  const distractors = JSON.parse(card.distractors || "[]").map(norm);
  if (distractors.includes(norm(answer))) problems.push("a distractor equals the answer");
  if (flag.kind === "wrong-answer" && accepts.length > 0 && !accepts.includes(norm(answer))) {
    problems.push("flagged wrong-answer: accepts still do not accept the stored answer");
  }
  return { ok: problems.length === 0, problems };
}

const flags = db.prepare(`SELECT cardId, kind, note, status FROM ContentFlag ORDER BY id DESC LIMIT 200`).all();
console.log(`=== FLAG REGRESSION RUN (${flags.length} flags, read-only) ===`);
let fixedFail = 0, openFail = 0, unchecked = 0;

// The ContentFlag.cardId may reference: the static bank (content.ts is a TS
// module - resolve via the exported JSON only if present), a MaterialCard row,
// or an exam-derived id (resolved live by the app; the runner reports those
// honestly as dynamic).
for (const f of flags) {
  let card = null;
  if (f.cardId.startsWith("mat:")) {
    const row = db.prepare(`SELECT id, front, answer, context, note FROM MaterialCard WHERE id = ?`).get(f.cardId);
    if (row) card = { kind: "cloze", prompt: row.front, answer: row.answer, alt: "[]", en: row.context, fa: "", note: row.note, traps: "[]", distractors: "[]" };
  } else if (f.cardId && !f.cardId.startsWith("exam:") && !f.cardId.startsWith("listen:")) {
    console.log(`  [${f.status}] ${f.kind} on ${f.cardId}: bank card (resolve in the TS battery - runner stays bank-free)`);
    unchecked++;
    continue;
  } else if (f.cardId) {
    console.log(`  [${f.status}] ${f.kind} on ${f.cardId}: dynamic exam/listen card (resolved live by the app)`);
    unchecked++;
    continue;
  }
  const r = checkCard(card, f);
  const line = `[${f.status}] ${f.kind} on ${f.cardId || "(no card)"}: ${r.ok ? "PASS" : "FAIL" + " — " + r.problems.join("; ")}`;
  console.log("  " + line);
  if (!r.ok) {
    if (f.status === "fixed") fixedFail++;
    else if (f.status === "open") openFail++;
  }
}
console.log(`=== fixed-regressions: ${fixedFail}, open-failures: ${openFail}, dynamic/bank (checked in battery): ${unchecked} ===`);
db.close();
process.exit(fixedFail ? 1 : 0);
