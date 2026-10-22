// The answerability gate - layer 1 of the exam quality architecture.
//
// ROOT CAUSE this module kills: generation was validated for SHAPE only
// (fields exist, choices present), never for ANSWERABILITY. That is how
// bare statements shipped as rewrite tasks ("Despite the storm, the flight
// departed on schedule." -> "Write the full sentence"), trivia quizzes
// shipped as English items, open blanks with five valid answers shipped
// with one key, and MCQs shipped whose key was not even among the choices.
//
// Every item passes through itemAnswerable() before it can reach a learner.
// Deterministic and free; the AI vetting layer (exam-ai.vetItems) handles
// what regex cannot see. Deterministic gates run on EVERY harvest round.

import type { ExamItem } from "./types";

export interface GateInput {
  type?: string;
  q?: string;
  a?: string;
  choices?: string[];
}

export interface GateVerdict {
  ok: boolean;
  reason: string;
}

// Encyclopedic trivia phrasings: these test world knowledge, not English.
// "What term describes...?" / "What do you call...?" / "Which document...?"
// If the model wants to teach a word, it must put it in a sentence blank.
const TRIVIA_REF =
  /\bwhat (is |was |are )?(the )?(correct |proper |english )?term\b|\bwhat term\b|\bwhat do you call\b|\bwhat do we call\b|\bwhat (word|verb|noun|adjective) (is used|describes|means)\b|\bwhich (document|instrument|device|tool|equipment|machine|department|ingredient)\b|\bname the (term|instrument|device|document|technique|practice)\b|\bwhat (technique|practice|sport|style|method) (is |describes|do)\b/i;

// A rewrite task carries an explicit instruction verb; a bare statement does
// not. "Rewrite using more formal vocabulary: '...'" passes; "Despite the
// storm, the flight departed on schedule." does not.
const REWRITE_TASK =
  /\b(rewrite|rephrase|reword|combine|join|transform|turn (it|this|that|them) into|make (it|this|that|the|them)|put (it|this|that) into|passive|reported|conditional|start(ing)? with|begin(ning)? with|using|so that|too \.\.\. to)\b/i;

// A short item needs a blank or an explicit form task; "give the comparative",
// "the plural of", "reported speech form". Open "what/which X ... ?" quizzes
// are trivia or unanswerable-with-one-key and die here.
const SHORT_TASK = /___|\bform\b|comparative|superlative|\bplural\b|\bopposite\b|\bsynonym\b|reported|passive|\bnegative\b/i;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Question-only fairness rules (no key needed): trivia ban, bare-statement
 *  ban, per-type task requirements. Used by itemAnswerable and by live evals
 *  where the delivered client payload carries no answer key. */
export function itemFairlyAsked(r: { type?: string; q?: string }): GateVerdict {
  const q = String(r.q ?? "").trim();
  if (!q) return { ok: false, reason: "empty" };

  const type = (["mcq", "cloze", "short", "rewrite"] as const).includes(r.type as never)
    ? (r.type as "mcq" | "cloze" | "short" | "rewrite")
    : "cloze";
  const hasBlank = q.includes("___");
  const hasQuestionMark = q.includes("?");
  const hasInstruction = REWRITE_TASK.test(q);

  // Trivia ban: encyclopedic term-hunting is not an English exercise.
  if (TRIVIA_REF.test(q)) return { ok: false, reason: "trivia" };

  // Bare statement ban: no blank, no question, no instruction verb. Whatever
  // the claimed type, the learner has no task to perform.
  if (!hasBlank && !hasQuestionMark && !hasInstruction) return { ok: false, reason: "bare statement" };

  if (type === "cloze" && !hasBlank) return { ok: false, reason: "cloze without a blank" };

  if (type === "short" && !hasBlank && !SHORT_TASK.test(q)) {
    return { ok: false, reason: "short item without a blank or a form task" };
  }

  // rewrite: the instruction MUST be inside q. A bare statement followed by
  // "Write the full sentence" is the exact bug class the user hit.
  if (type === "rewrite" && !hasInstruction) return { ok: false, reason: "rewrite without an instruction" };
  return { ok: true, reason: "" };
}

/** Deterministic answerability verdict. Exported for the quality evals. */
export function itemAnswerable(r: GateInput): GateVerdict {
  const asked = itemFairlyAsked(r);
  if (!asked.ok) return asked;

  const q = String(r.q ?? "").trim();
  const a = norm(String(r.a ?? ""));
  if (!a) return { ok: false, reason: "empty" };

  const type = (["mcq", "cloze", "short", "rewrite"] as const).includes(r.type as never)
    ? (r.type as "mcq" | "cloze" | "short" | "rewrite")
    : "cloze";
  const hasBlank = q.includes("___");

  if (type === "mcq") {
    const choices = (r.choices ?? []).map((c) => String(c).trim());
    if (choices.length < 2) return { ok: false, reason: "mcq needs choices" };
    // The key must BE one of the delivered choices, exactly (normalized).
    if (!choices.some((c) => norm(c) === a)) return { ok: false, reason: "key not among choices" };
    return { ok: true, reason: "" };
  }

  // Key leak: the answer already visible in the sentence outside the blank.
  if ((type === "cloze" || type === "short") && hasBlank) {
    const frame = norm(q.replace(/_{2,}/g, " "));
    if (frame.includes(a)) return { ok: false, reason: "key leaks into the sentence" };
  }
  return { ok: true, reason: "" };
}

/**
 * Distractor quality gate (Task 81, polish #5): an MCQ with duplicate,
 * empty or key-identical distractors is not a question - it is a giveaway.
 * Deterministic: same choices in, same verdict out.
 */
export function distractorQuality(choices: string[], a: string): GateVerdict {
  const key = norm(String(a ?? ""));
  const cleaned = choices.map((c) => String(c).trim()).filter(Boolean);
  if (cleaned.length !== choices.length) return { ok: false, reason: "empty distractor" };
  const normed = cleaned.map(norm);
  if (new Set(normed).size !== normed.length) return { ok: false, reason: "duplicate choices" };
  const distractors = normed.filter((c) => c !== key);
  if (distractors.length < 2) return { ok: false, reason: "fewer than 2 real distractors" };
  // Plausibility heuristic: at least one distractor should look like the key
  // (within a broad length band or sharing a word) - a 30-char distractor
  // against a 3-char key is a shape giveaway a test-taker spots instantly.
  const keyLen = key.length;
  const plausible = distractors.some((d) => {
    const lenOk = d.length >= keyLen * 0.4 && d.length <= keyLen * 2.5;
    const sharesWord = d.split(/\s+/).some((w) => key.split(/\s+/).includes(w));
    return lenOk || sharesWord;
  });
  if (!plausible) return { ok: false, reason: "distractors are not length/shape plausible vs the key" };
  return { ok: true, reason: "" };
}

/** Deterministic repair: trim + drop empties; keeps order and the key intact. */
export function repairChoices(choices: string[]): string[] {
  const cleaned = choices.map((c) => String(c).trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  const key = out; // order-preserving dedupe below
  for (const c of cleaned) {
    const n = norm(c);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(c);
  }
  return out;
}

// ---------- Quota enforcement: the evidence item ----------
//
// The gate does not only reject - when the weakness quota collapses (the
// model ignored it, or the vet stripped every tag), the exam builds its
// hunting item from the family's own evidence. A family's evidence is
// literally "wrong -> right": the token in the right sentence that fixes the
// wrong one is the forced answer; blank it and the family hunts itself.
// Deterministic, free, and honest by construction. The correction is
// preferred over bystander diffs: "childrens -> children are playing" must
// blank "children", not "playing".
// Shared blanking core: given "wrong -> right" evidence, find the correction
// token in the right sentence and blank it. Exported so the exam->FSRS bridge
// (exam-cards.ts) derives review cards with the EXACT same heuristic the exam
// gate uses - one source of truth for what "the correction" is.
export function blankCorrection(evidence: string): { prompt: string; answer: string } | null {
  const [wrong, right] = evidence.split(" -> ").map((s) => s.trim());
  if (!wrong || !right) return null;
  const wrongTokens = (wrong.match(/[A-Za-z']+/g) ?? []).map((t) => t.toLowerCase());
  const wrongSet = new Set(wrongTokens);
  const tokens = right.match(/[A-Za-z']+/g) ?? [];
  const diffs = tokens.filter((t) => !wrongSet.has(t.toLowerCase()));
  if (diffs.length === 0) return null;
  const correction = diffs.find((t) =>
    wrongTokens.some((w) => {
      if (w === t.toLowerCase() || Math.min(w.length, t.length) < 4) return false;
      return t.toLowerCase().startsWith(w.slice(0, 4)) || w.startsWith(t.toLowerCase().slice(0, 4));
    }),
  );
  const answer = correction ?? [...diffs].sort((a, b) => b.length - a.length)[0];
  if (answer.length < 2) return null;
  const prompt = right.replace(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), "___");
  if (!prompt.includes("___")) return null;
  return { prompt, answer };
}

export function evidenceItem(tag: string, evidence: string): ExamItem | null {
  const blanked = blankCorrection(evidence);
  if (!blanked) return null;
  const { prompt, answer } = blanked;
  return {
    id: `ev-${tag}-${Math.random().toString(36).slice(2, 7)}`,
    type: "cloze",
    skill: "grammar",
    q: prompt,
    a: answer,
    accept: [...new Set([answer, answer.toLowerCase()])],
    why: "Resurfaced from your own recorded miss on this pattern.",
    tag,
  };
}
