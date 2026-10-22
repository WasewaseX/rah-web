// Task 80 — content quality console (audit feature #10): the regression
// checks that run PER FLAG. A flag the coach marks "fixed" must stay fixed;
// a flag still "open" must show its current state honestly. This module is
// the deterministic check itself (pure, no DB): given the flagged card and
// the flag, what is broken?
//
// The integrity rules mirror the exam engine's answerability gate so bank
// cards, material cards and exam-derived cards are held to ONE bar.

import type { Card } from "@/lib/content";

export interface FlagLike {
  cardId: string;
  kind: string;
  note: string;
  status: string; // open | fixed | wontfix
}

export interface IntegrityResult {
  ok: boolean;
  problems: string[];
}

export const FLAG_KINDS = ["typo", "wrong-answer", "bad-audio", "unclear", "other"] as const;

export function checkCardIntegrity(card: Card | null | undefined, flag: FlagLike): IntegrityResult {
  const problems: string[] = [];
  if (!card) {
    problems.push("card not found (deleted or foreign id) — the flag cannot be verified");
    return { ok: false, problems };
  }
  if (!card.prompt || !card.prompt.trim()) problems.push("prompt is empty");
  if (!card.answer || !card.answer.trim()) problems.push("answer is empty");
  if (!card.en || !card.en.trim()) problems.push("example sentence (en) is empty");
  const norm = (s: string) => s.toLowerCase().replace(/[.,!?;:'"()]/g, "").replace(/\s+/g, " ").trim();
  const accepts = (card.alt ?? []).map(norm);
  const answerNorm = norm(card.answer);
  if (card.kind === "cloze" && accepts.length > 0 && !accepts.includes(answerNorm) && !norm(card.prompt).includes("__")) {
    // cloze cards type the blank: accepts must contain the answer shape
    problems.push("cloze accepts list does not contain the answer (case/space-normalized)");
  }
  if ((card.distractors ?? []).some((d) => norm(d) === answerNorm)) {
    problems.push("a distractor equals the answer — the item is unanswerable as an MCQ");
  }
  if (flag.kind === "wrong-answer" && !accepts.includes(answerNorm) && accepts.length > 0) {
    problems.push("flagged wrong-answer: the accepts list still does not accept the stored answer");
  }
  return { ok: problems.length === 0, problems };
}

/** Human-readable regression line for the console/runner output. */
export function regressionLine(flag: FlagLike, result: IntegrityResult): string {
  const head = `[${flag.status}] ${flag.kind} on ${flag.cardId || "(no card)"}: ${result.ok ? "PASS" : "FAIL"}`;
  return result.ok ? head : head + " — " + result.problems.join("; ");
}
