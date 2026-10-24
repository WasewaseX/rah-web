# SPEAK-PLAN — goal-bound Talk: Learn → Practice → Apply (backlog T-2/T-3/F-5)

Written 2026-10-25 (Task 96). **GATE BANNER — read first:** per
`TASK-95-BACKLOG.md`, NO feature code ships while any Part-A P0 is open.
This document is the design, the data contract, and the test plan only.
It exists so gate clearance converts directly into a bounded vertical slice.
Phoneme-level claims stay disabled regardless of gates: word-level
`measured:asr-alignment` is the current measured tier (A-7 governs anything
finer).

## 1. Goal

Turn Talk from an open chatbot into Speak's published loop, adapted to Rah's
doctrine: the learner picks an adult-life scenario and a stated goal; the
system drills phrases the learner has ALREADY met (FSRS-scheduled review
content); practice rotates the same phrases through varied frames; the Apply
conversation runs with an explicit, visible difficulty parameter; the session
ends with a persisted receipt that feeds mistakes back into the existing
memory/FSRS paths. Every element lands in the measured ledger — no vanity XP,
no unmeasured AI-generated analytics.

**Non-goals:** a new conversation engine (Talk's existing scene partner
stays); phoneme feedback (A-7); streak-style gamification detached from
measurement (SPEAK-RE §3); a parallel grading path (the receipt reuses the
existing speak grade/assess routes — never double-grades).

## 2. Current-state inventory (verified in the tree, 2026-10-25)

| Ingredient | Where | Shape |
|---|---|---|
| Talk session surface | `src/components/rah/Speak.tsx` + `src/app/api/speak/route.ts` | prompt → transcript → SpeakSession rows (rounds 1/2 monologue) |
| Grading | `src/app/api/speak/grade` + `src/lib/asr.ts` | measured transcription + word alignment; rate-limited |
| Analytics | `src/app/api/speak/analytics` | recent graded sessions, same-prompt retry deltas, error families |
| Mistake feedback | `src/lib/mistakes.ts` | `recordMistakes(kind: "speak", ...)`; family healing loop |
| Review scheduling | `src/lib/fsrs.ts` + CardState | the queue Learn/Practice must draw from and return to |
| Curriculum graph | `src/lib/curriculum.ts` | 18-node B2→C1 graph with prerequisite gates — scenario difficulty anchors to it |
| Session ledger | `SpeakSession` model | `{ userId, prompt, transcript, round, result (JSON string), at }` |

## 3. Design — one new scenario library + one session wrapper, everything else reused

**3.1 Scenario library (content-as-code, versioned in git).**
`src/lib/speak-scenarios.ts` ships ~10 adult-life scenarios in the same
spirit as the assess route's `READ_ALOUD_TARGETS` (static, reviewable,
deterministic): each `{ id, version, title, goal, cefrAnchor, phrases[5–8],
surpriseTurns[], difficultyLadder[3] }`. Phrases are multi-word expressions
with register notes — these double as the seed content for backlog T-2
(expression/collocation cards). No vendor content; original scenarios,
provenance-tagged like every content surface.

**3.2 Learn/Practice phase (before Apply).** The wrapper selects from the
scenario's phrase set, ordered by the learner's actual state:
already-in-queue phrases first (CardState exists), then reviewed-at-least-once,
then new phrases marked honestly as new. Practice rotates four frames —
repeat-after → produce-from-English → substitution (word swap) →
mini-dialogue turn — each graded through the EXISTING speak assess/grade
paths so every attempt is a measured event, not a progress bar. A learner
with zero matching cards gets a Learn-first session that says so; it never
invents "already learned" state.

**3.3 Apply phase (goal-bound Talk).** The conversation is Talk with a
scenario binding and a difficulty parameter the UI renders explicitly:
D0 = rehearsed phrases in rehearsed order; D1 = shuffled + one surprise turn;
D2 = reformulation demanded (say it differently), surprise turns unannounced.
Progression D0→D1→D2 is EARNED: the receipt's produced-ratio gates it
(default ≥ 0.8 produced at Dn across two consecutive sessions), and the rule
is deterministic and testable, not model-judged.

**3.4 Exit receipt (the honest close).** On session end the wrapper persists
one SpeakSession row (round 3 = goal-bound apply; result JSON below):

```jsonc
{
  "type": "goal-bound-apply",
  "scenarioId": "job-interview", "scenarioVersion": 1,
  "goal": "answer the 'tell me about yourself' question without switching to memorized text",
  "difficulty": 1,
  "targets": [
    { "phrase": "I've been responsible for...", "status": "produced", "attempts": 2 },
    { "phrase": "My background is mostly in...", "status": "fumbled", "attempts": 3,
      "evidence": "heard: 'My background it is mostly...' — copula slip" },
    { "phrase": "Let me think about that for a second", "status": "avoided", "attempts": 0 }
  ],
  "corrections": [{ "wrong": "...", "right": "...", "kind": "speak" }],
  "retries": 1, "nextFocus": "copula + hedging phrase",
  "tier": "measured:asr-alignment"
}
```

**3.5 Feedback loop.** `fumbled` and `avoided` phrases flow into
`recordMistakes(kind: "speak", tag: "phrase_" + slug)` and re-enqueue as
review cards via the SAME path as ELSA-PLAN Wire 2 — idempotent by
deterministic id, never double-graded (the receipt records attempts; the
grade ledger stays the single source of grading truth). `produced` phrases
with clean attempts count toward the family healing loop exactly like exam
clean hits (2 clean → retire).

## 4. Rules the tests must pin

1. **Phrase selection** only draws from queue/reviewed/new-honest states;
   never fabricates "already learned".
2. **Progression** D0→D1→D2 gated by the produced-ratio arithmetic, visible
   in the UI; regression (a failed D1 session) does NOT silently drop back —
   it records and states it.
3. **Empty/partial speech** → honest receipt rows (`status: "avoided"`,
   attempts 0), never a fabricated produced ratio; an empty transcript
   persists as an attempted session with all targets avoided.
4. **Retry accounting** — `retries` counts real repeated sessions on the
   same scenario+goal; analytics retry deltas keep working off the same rows.
5. **Receipt persistence** — exactly one round-3 row per session; the result
   JSON parses; `tier` present on every row.
6. **Isolation** — scenario state, receipts, families, and cards all
   user-scoped; user B's receipts never leak into A's progression gate.
7. **Duplicate events** — replaying a session's grade (offline GradeAck
   replay) never double-counts attempts or re-fires mistake recording.
8. **Degraded AI behavior** — the scene partner's offline placeholder and
   banner rules extend to Apply; a session that degrades marks the receipt
   `degraded: true` and the progression gate ignores degraded sessions.
9. **Whole flow** — browser E2E: pick scenario → Learn → Practice frames →
   Apply conversation → receipt visible → fumbled phrase appears in the
   review queue.

## 5. Test plan (deterministic; extends the speak + isolation batteries)

| # | Case | Pin |
|---|---|---|
| S1 | selection | queue-only learner gets only queue phrases; empty learner gets Learn-first + honest labels |
| S2 | frames | 4 practice frames each produce exactly one measured event; no frame writes progress without a grade |
| S3 | gate arithmetic | produced-ratio 0.79 at D1 twice → stays D1; 0.8 twice → D2 unlocked; degraded sessions excluded |
| S4 | receipt shape | round-3 row parses against the contract; missing tier → battery fails |
| S5 | avoided/fumbled → memory | one family per phrase tag; replay → count++ not duplicate |
| S6 | clean-hit healing | two produced-with-clean-attempt sessions → family resolvedAt set |
| S7 | isolation | two users, same scenario → disjoint progression + receipts |
| S8 | duplicate replay | GradeAck replay → one review row, attempts unchanged |
| S9 | degraded | AI down mid-Apply → placeholder + banner + `degraded: true`, gate ignores the session |
| S10 | browser E2E | the full §4.9 flow on the throwaway stack |

## 6. Acceptance criteria (when the gates clear)

- S1–S10 green; full battery, tsc, lint, prod E2E, CI green.
- The Talk UI shows scenario, goal, difficulty, and the receipt at exit;
  the pilot ledger records goal-bound sessions distinctly (round 3) so
  `pilot-metrics.mjs` can report speaking volume without ambiguity.
- `SPEAK-RE.md` §4 rows updated with shipped evidence; backlog Part B
  (T-2/T-3/F-5 word-tier) statuses updated.

## 7. Human inputs still required before implementation

1. A-1 purge filing verified complete (standing P0).
2. A-2 database decision signed (schema-neutral by design — receipts live
   in the existing `result` JSON — but the gate is the gate).
3. Scenario content review (the account holder reads the 10 scenarios for
   register appropriateness) — content, not code, so it can happen in
   parallel with the gates.
