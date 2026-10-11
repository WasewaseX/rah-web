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
