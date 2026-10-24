# ELSA-SPEAK-RE — Reverse engineering ELSA Speak, the Rah way

Written 2026-10-24 (Task 95). Doctrine unchanged since Task 26: study
OBSERVABLE product workflows and published documentation — no proprietary
source, no assets, no scraping. What Rah takes is the loop architecture, not
the pixels.

## 1. What ELSA observably does (verified against their published FAQ and current product pages, 2026-10)

1. **Diagnosis-first funnel**: an initial reading assessment locates the
   learner's problem sounds, then the course is BUILT from that diagnosis —
   the learner studies their weakest sounds first, not a fixed syllabus.
2. **Sound-by-sound feedback on real audio**: the learner reads a prepared
   sentence; the app scores pronunciation at phoneme level and marks which
   vowel was off, which consonant was muted, which syllable took the wrong
   stress — with a phonetic transcription layer under the sentence showing
   exactly where the attempt diverged from the target.
3. **Visual mouth mechanics**: color-coded sound charts explain what the
   tongue, lips, and airflow should do for the problem sound — the feedback
   is actionable (a physical instruction), not just a red score.
4. **Replayable model + targeted retry**: the learner hears the model
   pronunciation, retries the SAME sentence, and the app tracks the sound's
   improvement over time — a loop, not a one-shot grade.
5. **Honest scope**: ELSA is a drill tool (5–10 min sessions), deliberately
   NOT a conversation tutor — its own positioning keeps the measured domain
   (pronunciation) separate from the conversational domain.

## 2. The one thing worth stealing: diagnosis → drill → re-measure

ELSA's product is a CLOSED LOOP on a single measurable variable:
diagnose the sound → prescribe the drill → re-measure the same sound →
move on when the measurement improves. Most apps (including Rah today)
measure well but let the learner wander; ELSA's funnel makes the next
exercise a FUNCTION of the last measurement.

Rah already has every ingredient except the wiring:
- measurement: `measured:asr-alignment` word tier (battery-pinned) and the
  Azure phoneme tier behind the PRONUNCIATION-VALIDATION.md gate;
- drills: the review engine (FSRS) and Sound Lab;
- memory: mistake memory already records recurring weaknesses with evidence.

The missing wire is: **a flagged word in a read-aloud assessment should be
able to enqueue itself as a review card / Sound Lab drill, and the same
sound's next assessment score should appear next to the drill that targeted
it.** That is backlog item P-1 (below) — small, measurable, and it closes
the loop instead of adding a feature.

## 3. What Rah should explicitly NOT copy

- **Subscription-gated diagnosis**: the diagnosis is the upsell. Rah's
  pilot runs on honest measurement; gating the diagnostic behind anything
  would corrupt the pilot data.
- **Phoneme claims without a validated key**: ELSA's scoring runs on their
  own validated models. Rah's Azure tier stays dormant until
  PRONUNCIATION-VALIDATION.md passes — copying the CLAIMS without the
  validation would be exactly the slop the house doctrine forbids.
- **Fixed scripted sentences only**: ELSA's drills are read-aloud of
  prepared lines. Rah's read-aloud should keep pulling from the learner's
  OWN vocabulary debt (mistake memory), which makes the measurement
  personal — better than a generic script.

## 4. Concrete takeaways → backlog mapping

| ELSA behavior | Rah surface | Backlog item |
|---|---|---|
| Diagnosis builds the course | placement + mistake memory | P-1: assessment-flagged words auto-enqueue as drills |
| Phoneme-level scoring | Azure adapter (gated) | P-2: pass PRONUNCIATION-VALIDATION.md before any UI claim |
| Mouth-mechanic instruction | Farsi-specific transfer-error content | P-3: per-sound Persian contrast notes (review feature F-6) |
| Retry-until-improved loop | read-aloud + FSRS | P-1's re-measure side: same-sound score deltas recorded |
| Drill-length honesty | session design | keep Sound Lab sessions short and measurable; no vanity length |

## 5. Verification note

Everything in §1 comes from ELSA's own published FAQ ("How does ELSA's
pronunciation feedback work?") and current product pages, cross-checked
against independent 2026 comparisons. No proprietary material was accessed.
Where ELSA's behavior is described in marketing language, the table in §4
states the OBSERVABLE behavior only.

## 6. Implementation plan (Task 96)

The reviewer's direction after Task 95: implementation planning and
evidence-backed integration — not more high-level research. The loop in §2
is now fully specified in **`ELSA-PLAN.md`**: three wires (flag→family,
family→FSRS drill via existing paths, re-measure→before/after), a
field-level data contract, the idempotency/isolation rules, and a 10-case
deterministic test plan. Per `TASK-95-BACKLOG.md` the implementation is
gated behind the open Part-A P0s; this RE doc will not be extended further
until the plan ships or the gates force a redesign.
