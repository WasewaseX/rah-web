# Grammarly RE — loop mechanics, what ships, what is deliberately NOT copied

Benchmark #5 in the reverse-engineering series (Duolingo, Anki, ELSA, LingQ before it).
Target: Grammarly's writing editor — because the external audit's exact residual on Rah
was "the writing editor is not yet a comprehensive revision-and-rubric system". This RE
names the mechanics that phrase concretely, then ships the honest subset.

## The loop, stripped to mechanics

1. **Live, offset-anchored rule pass while you type** (debounced). The first screening
   layer is deterministic rule matching, not AI: every finding is a span of YOUR text
   located by `offset + length`, with a category, a short rationale, and 0..n candidate
   replacements. Nothing is rewritten behind your back — you see where, why, and what.
2. **Per-finding accept/dismiss**. Accepting applies ONE replacement at ONE offset — a
   deterministic string splice. Dismissing hides that finding. The editor text only ever
   changes through an explicit user action on a visible finding.
3. **Score + category split**. An overall score recomputed per edit, split into
   correctness / clarity / engagement / delivery. The first two are rule-derivable; the
   last two are proprietary model outputs.
4. **Goals scale the feedback**. Audience, formality, domain, intent are set per document
   and change which suggestions surface (formal register flags contractions; casual does
   not) and how the score is framed.
5. **Revision telemetry**. Accepted/dismissed counts per category; over revisions you see
   which categories you actually fix vs ignore.

## What Rah ships from this (and why it is honest)

- **Live pre-flight, same engine the grader already trusts.** The LanguageTool screen
  (`/api/grammar-check`) now returns `offset`/`length` for every finding, and the writing
  editor runs it debounced while you type. Findings render as underlines in a mirrored
  highlight layer (error = rose, style = cyan) plus a card list below the editor. This is
  the SAME rule engine that grounds and backstops the AI grader (writing route: LT first,
  LLM confirms/explains, rule errors the model ignored are backstop-merged) — one source
  of truth, no second opinion invented for the editor.
- **Accept = deterministic splice.** Applying a replacement splices the exact
  `[offset, offset+length)` span; the finding dies and the debounced recheck re-screens
  the new text. Ignore is per-finding for the session. No AI writes to your draft.
- **Goal chips (exam / work / casual)** — sent with the submission, folded into the
  grader prompt (exam = strict academic register, work = concise professional, casual =
  natural rhythm), and stored inside the saved result JSON as provenance of what was
  asked of the grader. Declared as a prompt input, not dressed up as a scorer.
- **"Practice estimate" score strip.** The four CEFR criterion scores (task,
  organization, range, accuracy) now also render as one average with the label
  "practice estimate — not an official CEFR grade", enforcing the standing
  claim-precision rule (exam-style scores are estimates until grading is validated
  against expert-reviewed responses and exam-specific rubrics).

## Deliberately NOT copied

- **Grammarly's proprietary 0–100 score.** Its category weights are unknown; synthesizing
  one number would fake precision Rah does not have. The four criteria stay separate, and
  the single average that does ship is labeled an estimate.
- **Tone detector, engagement/delivery subscores.** No corpus, no validated model —
  inventing them would violate the measured-vs-inferred epistemics (same reason LingQ's
  per-token known-word ledger was declined).
- **Plagiarism checker.** Needs an external search corpus; out of scope.
- **Cloud revision history of YOUR drafts beyond the submission chain.** Rah keeps the
  revision chain the learner explicitly creates (parentId/revision + criterion deltas +
  fixed/remaining/introduced change summaries, Task 83) — not silent per-keystroke
  capture.
- **Weekly digest emails.** MailLog exists for transactional mail; marketing cadence is
  not a learning mechanic.

## Test surface

- Battery: grammar-check findings carry numeric `offset`/`length` and
  `text.slice(offset, offset+length) === excerpt` (the splice contract accept relies on);
  goal roundtrip lands in the stored result JSON; submitted goal reaches the grader.
- The splice mechanic itself is exercised by the browser E2E (accept a replacement, the
  editor text changes at the right place).
