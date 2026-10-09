// The verifier. Every envelope passes through here before the learner sees
// it. It kills the failure modes the learner actually hit: Farsi leaking into
// English lines, AI-sign phrases, refusal text where an exam should be, and
// count drift between announced and graded items.

import type { CoachEnvelope } from "./types";

const PERSIAN = /[\u0600-\u06FF\u0750-\u077F]/;

const BANNED: [RegExp, string][] = [
  [/as an ai\b[^.]*\.?/gi, ""],
  [/as a language model[^.]*\.?/gi, ""],
  [/i(?:'m| am) (?:an|just a) (?:ai|language model|bot)[^.]*\.?/gi, ""],
  [/i (?:cannot|can't|can not) (?:create|generate|make|build|produce) (?:exams?|tests?|quizzes?)[^.]*\.?/gi, ""],
  [/i (?:cannot|can't|can not) (?:do|make) that[^.]*\.?/gi, ""],
  [/i(?:'m| am) sorry,? (?:but )?i (?:cannot|can't)[^.]*\.?/gi, ""],
  [/certainly!?|of course!?/gi, ""],
];

function sanitizeReply(s: string): string {
  let out = s;
  for (const [re, sub] of BANNED) out = out.replace(re, sub);
  // Farsi inside the English field is a hard failure: split it out.
  if (PERSIAN.test(out)) {
    out = out
      .split(/(?<=[.!?\u061F])\s+/)
      .filter((seg) => !PERSIAN.test(seg))
      .join(" ");
  }
  return out.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function verifyEnvelope(env: CoachEnvelope): CoachEnvelope {
  const out: CoachEnvelope = { ...env };

  // Reply: English only, no AI-sign leakage, sane length.
  out.reply = sanitizeReply(String(out.reply ?? ""));
  if (out.reply.length > 1600) out.reply = out.reply.slice(0, 1570).replace(/\s\S*$/, "") + " ...";

  // Farsi tail only when corrections exist (or the skill legitimately explains).
  const explainers = new Set(["correct", "translate", "chat", "explain", "minimal-pairs", "coach-report", "summarize", "daily-challenge", "socratic", "roleplay", "debate"]);
  if ((out.corrections?.length ?? 0) === 0 && !explainers.has(out.skill)) out.fa_note = "";

  // Exam consistency: announced count IS graded count, always.
  if (out.exam) out.exam.count = out.exam.items.length;

  // Steps: never empty, so the agent trace is always visible.
  if (!out.steps || out.steps.length === 0) out.steps = [{ label: "Coach turn" }];

  // Never hand back a bare envelope.
  if (!out.reply) out.reply = "Say that again? I lost the thread for a second.";
  return out;
}
