# MAGOOSH-IELTS-RE — Reverse engineering Magoosh IELTS, the Rah way

Written 2026-10-24 (Task 95). Doctrine unchanged: observable workflows and
published product pages only — no proprietary question banks, no assets.

## 1. What Magoosh IELTS observably does (verified against magosh.com/ielts published pages and study-guide pages, 2026-10)

1. **Systematic tracks, not random practice**: four printed study schedules
   (1 Month Academic, 1 Month General Training, 1 Week Academic, 1 Week
   General Training), each a day-by-day plan pairing video lessons, practice
   questions, and full-length tests — preparation becomes a SCHEDULE the
   learner can follow, not a content pile.
2. **Volume with structure**: the paid course advertises 850+ practice
   questions and 10 full-length practice tests, each question with a video
   or text explanation — quantity is organized BY the exam's real section
   structure (Listening / Reading / Writing / Speaking).
3. **Score prediction with an explicit guarantee**: a target-score guarantee
   (+0.5 band or money back) built on a score-prediction flow — practice
   results convert into a projected band, which is the product's core
   promise. (The guarantee's terms are the honest part: it is a refund, not
   a certification.)
4. **Expert-authored, exam-accurate tasks**: questions are written by IELTS
   instructors to match the exam's task types and rubrics — the value
   proposition is FIDELITY, not cleverness.
5. **Help-first funnel**: study guides and free practice tests are public;
   the paid product is the structured version of the same material.

## 2. What Rah should take: make the examination track systematic and testable

Rah already generates exams and grades writing against rubrics. What the
Magoosh model adds is the SYSTEM around the tasks:

1. **Named tracks with schedules**: a "C1 Advanced track" or "IELTS B2→C1
   track" is a versioned sequence of (task types × days), rendered from the
   curriculum graph — not an ad-hoc quiz generator. The learner always knows
   what today's exam-prep slot contains and why.
2. **Every task carries its rubric explanation**: Magoosh's per-question
   explanation is the observable thing to copy: Rah's exam items should
   expose WHY the distractors are wrong and which rubric band the response
   hit — explanations are content, first-class and versioned.
3. **Score ranges, not false precision** (the review's feature #2 verbatim):
   practice results convert into a projected band WITH uncertainty
   ("6.5–7.0, based on 14 graded tasks, wide interval — small sample"), and
   the UI shows the sample size behind the estimate. A refund-guarantee
   marketing number without uncertainty would be exactly the false
   precision the reviewer warned against.
4. **Full-length mock cadence**: one full mock per N weeks of the track,
   scheduled like a review card, with before/after band deltas recorded in
   the pilot ledger — the exam track becomes measurable evidence.

## 3. What Rah should explicitly NOT copy

- **Guarantee marketing**: a band guarantee is a refund policy, not an
  educational claim; Rah's pilot lives on honest labels and would never
  promise a score.
- **Question-bank quantity as the product**: 850+ questions is a content
  moat Rah cannot and should not race to. Rah's moat is the measurement
  layer (FSRS + provenance-validated materials + rubric history); exam
  items stay few, provenance-checked, and well-explained.
- **Schedules without adaptation**: Magoosh's PDFs are static. Rah's tracks
  should re-plan from actual performance (the existing goal planner already
  does this arithmetic — reuse it).

## 4. Concrete takeaways → backlog mapping

| Magoosh behavior | Rah surface | Backlog item |
|---|---|---|
| Day-by-day exam tracks | curriculum graph + goal planner | T-9: versioned exam tracks rendered from the graph |
| Per-question explanations | exam generation + grading | T-8: distractor rationale + rubric-band explanation on every item |
| Band prediction | placement + exam grading | F-2: expert-calibrated band ranges WITH uncertainty + sample size |
| Full-length mock cadence | goal planner | T-9's mock scheduling; deltas land in db/pilot/series.md |
| Rubric fidelity | writing rubric system | polish #5: calibrate rubrics against human-rated samples |

## 5. Verification note

§1 comes from Magoosh's own IELTS pages (plans page, home page, study-guide
guide) — all published marketing/product documentation, quoted sparingly and
by name. The count claims (850+ questions, 10 tests) are THEIRS and are
described as advertised claims, not verified inventory. No proprietary
question content was accessed.

## 6. Implementation plan (Task 96)

The §2 system is now fully specified in **`MAGOOSH-PLAN.md`**: tracks as
versioned content-as-code documents (no new tables before the A-2
decision), the six-fields-per-day schedule contract, the first-class
explanation + distractor-rationale item contract, band RANGES with sample
size and the per-rubric-version ≥20-human-rated calibration gate, and the
goal-planner-based re-planning rules — plus a 10-case deterministic test
plan. Implementation is gated behind the open Part-A P0s per
`TASK-95-BACKLOG.md`; the calibration set cannot be manufactured by the
agent, so `calibrated: false` remains the only honest render until the
human-rated evidence exists.
