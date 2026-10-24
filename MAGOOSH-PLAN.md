# MAGOOSH-PLAN — versioned exam-preparation tracks (backlog T-8/T-9, F-2)

Written 2026-10-25 (Task 96). **GATE BANNER — read first:** per
`TASK-95-BACKLOG.md`, NO feature code ships while any Part-A P0 is open.
Deliverables in this document: the schema, the track specification, the
acceptance criteria, and the test plan. Band estimates remain
**practice-estimate RANGES with uncertainty**; the estimator is never called
"calibrated" until the ≥20-human-rated-responses gate passes (backlog F-2,
verbatim). Nothing from Magoosh is copied: no question bank, no video
content, no branding, no score guarantees — original, provenance-tracked
content only (MAGOOSH-IELTS-RE §3).

## 1. Goal

Replace ad-hoc generated quizzes, for exam preparation, with named, versioned
tracks: IELTS Academic and General Training, each in a 4-week and a 1-week
shape — a day-by-day schedule the learner can follow, where every day names
its curriculum nodes, skill/task type, preparation material, practice tasks,
review debt, and its place in the mock-test cadence. Every item carries an
answer explanation including why the plausible distractors are wrong; every
writing/speaking report maps feedback to explicit rubric criteria; progress
re-plans from measured performance and lands in the durable pilot ledger.

**Non-goals:** score guarantees or any official-claim adjacency (the
"not an official score" disclaimer family stays on every surface); a
quantity race (items stay few, provenance-checked, well-explained — the
measurement layer is the moat, not a 850-question bank); static PDF-style
schedules (re-planning from measured performance is a requirement, not a
v2 nice-to-have).

## 2. Current-state inventory (verified in the tree, 2026-10-25)

| Ingredient | Where | Shape |
|---|---|---|
| Exam generation + grading | `src/app/api/exam/*` + `Exam` model | `{ id, title, spec: JSON, items: JSON (answers/accept/mustInclude), status, result: JSON }` |
| Format tracks (Task 66) | exam lib | IELTS/TOEFL/C1A task-type mixes + rubric briefs + deterministic rough band reference (monotone, clamped) + practice-estimate labels + not-affiliated disclaimers |
| Curriculum graph | `src/lib/curriculum.ts` | 18-node B2→C1 prerequisite graph, proven-only mastery gates |
| Adaptive planning | `src/lib/goals.ts` + Goal model | the re-planning arithmetic to reuse |
| Rubric grading | writing/speaking rubric system + `WritingSub` | per-skill totals; practice-estimate labels battery-pinned |
| Durable pilot ledger | `db/pilot/series.md` + vault | weekly checkpoints; mock deltas must land here |

## 3. Schema — tracks as versioned documents, zero new tables while A-2 is open

Tracks are **content-as-code**: versioned JSON documents in
`src/lib/exam-tracks/`, rendered deterministically at request time. History
lives in git (the same doctrine as the curriculum graph). No Prisma
migration is required or wanted before the A-2 decision; if Option B
(PostgreSQL) lands, a `TrackProgress` table follows the decision — the
document schema below is deliberately decision-neutral.

```jsonc
// src/lib/exam-tracks/ielts-academic-4w.json (one file per track)
{
  "id": "ielts-academic-4w",
  "version": 1,                       // bumped on ANY content change
  "family": "ielts-academic",         // ielts-academic | ielts-gt
  "durationWeeks": 4,
  "days": [
    {
      "n": 5,
      "nodeIds": ["b2-integration-3"],          // curriculum graph references
      "skill": "reading", "taskType": "tfng",   // exam task taxonomy
      "prepMaterialIds": ["mat-ielts-tfng-strategy"],
      "practiceTaskIds": ["it-tfng-001", "it-tfng-002"],
      "reviewDebtMinutes": 10,                  // FSRS time reserved that day
      "mock": null,
      "replanNote": null                        // renderer may rewrite when re-planning
    }
  ],
  "mockCadence": { "everyNDays": 7, "fullMocks": [7, 14, 21, 28] },
  "rubricVersion": "ielts-writing-1"          // see §5 — versioned with items
}
```

Renderer rules: the track renderer is a pure function
`(trackDoc, learnerState, today) → ScheduleDay[]` — deterministic, no model
calls; two calls with the same inputs render byte-identical schedules.
Missed days compress forward (shift, never silently drop); a day whose
practice tasks are unmet renders its `replanNote`; the learner can always
see why today looks the way it does.

## 4. Item contract — explanations are content, first-class

Every track item (and, incrementally, existing exam items) carries:

```jsonc
{
  "id": "it-tfng-001", "itemVersion": 1, "skill": "reading", "taskType": "tfng",
  "provenance": { "source": "original", "reviewed": true, "reviewer": "account-holder" },
  "explanation": "The passage says X, so the statement is TRUE because Y.",
  "distractors": [
    { "answer": "FALSE",        "whyWrong": "The passage does not contradict X; ..." },
    { "answer": "NOT GIVEN",    "whyWrong": "The passage never addresses Z; absence is not contradiction." }
  ],
  "rubricCriteriaRefs": []    // non-empty for writing/speaking items
}
```

Battery rule: **explanation coverage is a test, not an aspiration** — an
item with an empty explanation or an empty `distractors[].whyWrong` for a
multiple-choice-style task fails the battery. Writing/speaking reports map
every feedback line to an explicit rubric criterion id (task response,
coherence, lexical resource, grammatical range; fluency, lexical, grammar,
pronunciation-adjacent word-tier note) — free-floating praise without a
criterion ref is a battery failure.

## 5. Band ranges — uncertainty is the contract, calibration is a gate

Every projected band renders as a RANGE with its evidence:

```jsonc
"band": {
  "low": 6.0, "high": 7.0,          // range, never a point
  "sampleSize": 14,                  // graded tasks behind it
  "uncertainty": "wide",             // wide | moderate | narrow — from sample size
  "calibrated": false,               // true ONLY after the F-2 gate
  "rubricVersion": "ielts-writing-1",
  "label": "Practice estimate, not an official score"
}
```

- Range width comes from a documented monotone mapping of sample size
  (≤5 → ≥1.0 band width; 6–19 → 0.5–1.0; ≥20 AND calibrated → 0.5 floor);
  the mapping table lives in code next to the renderer and is battery-pinned.
- **Calibration gate (F-2 verbatim):** `calibrated: true` requires ≥20
  human-rated responses per rubric version with recorded rater agreement;
  until then the UI says "practice estimate — not calibrated against expert
  ratings". The gate is per rubric VERSION, not global.
- Mock deltas (band range midpoint + width per mock) append to the durable
  pilot series — the exam track becomes measurable evidence, per the RE doc.

## 6. Re-planning — reuse the goal planner's arithmetic

Schedule re-planning consumes measured performance (graded task accuracy,
review-debt completion, mock ranges) through `goals.ts`' existing planner —
no parallel arithmetic. Rules: unmet practice on a day shifts the day and
renders a visible reason; two consecutive shifted days triggers a schedule
compression proposal the learner must accept (no silent mutation); mock days
never shift silently — they resurface within 3 days or flag.

## 7. Test plan (deterministic)

| # | Case | Pin |
|---|---|---|
| M1 | track determinism | same (trackDoc, state, today) → byte-identical schedule, twice |
| M2 | version pinning | v1 history renders identically after v2 ships (version field honored) |
| M3 | prerequisites | a day whose nodeIds are unmastered renders locked with named blockers (curriculum graph rules) |
| M4 | replanning | missed day → shift + replanNote; two misses → compression proposal, learner-accept required |
| M5 | completion/recovery | completing a day marks it; a wiped-progress recovery (restore drill) re-derives the same state from the ledger |
| M6 | explanation coverage | every item has explanation + distractor whys (seed set); a deliberately empty item fails the battery |
| M7 | rubric versions | writing/speaking feedback lines all carry rubricCriteriaRefs; unknown ref → battery failure |
| M8 | small-sample uncertainty | 3 graded tasks → width ≥ 1.0 + "small sample" wording; 14 → 0.5–1.0; the mapping table is the pin |
| M9 | calibration gate | 19 human-rated → `calibrated: false` renders; the 20th + agreement record flips ONLY that rubric version |
| M10 | isolation + E2E | two users' track progress disjoint (where progress persists per-user post-A-2); browser E2E: pick track → render today → complete a task → band range with sample size renders |

## 8. Acceptance criteria (when the gates clear)

- M1–M10 green; full battery, tsc, lint, prod E2E, CI green.
- The four seed tracks (Academic/GT × 4w/1w) render day-by-day with all six
  required fields per day; zero items without explanations; zero band
  outputs without range + sample size + label.
- `MAGOOSH-IELTS-RE.md` §4 rows updated with shipped evidence; backlog F-2/
  T-8/T-9 statuses updated; the calibration ledger (rubric version →
  human-rated count) is visible in the admin surface.

## 9. Human inputs still required before implementation

1. A-1 purge filing verified complete (standing P0).
2. A-2 database decision signed (the doc schema is decision-neutral; the
   `TrackProgress` table waits for it).
3. The ≥20 human-rated response set per rubric version (F-2's explicit
   backlog requirement) — cannot be manufactured by the agent; until it
   exists, `calibrated: false` is the only honest render, and that is the
   design working as intended.
4. Content review of the seed items' explanations (register, accuracy) by
   the account holder — content gate, parallelizable.
