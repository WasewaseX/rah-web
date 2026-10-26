# ELSA-PLAN — closing the diagnosis → drill → re-measure loop (backlog P-1)

Written 2026-10-25 (Task 96). **GATE BANNER — read first:** per
`TASK-95-BACKLOG.md`, NO feature code ships while any Part-A P0 is open
(purge filing, PG decision, validation inputs). This document is the
deliverable: the design, the data contract, and the test plan. The smallest
vertical slice is specified below so that the moment the gates clear,
implementation is a single bounded task — not a research project. The Azure
phoneme adapter stays gated behind `PRONUNCIATION-VALIDATION.md` (A-7)
regardless: without real credentials and a passing run, nothing may claim or
display validated phoneme-level scoring.

## 1. Goal

An assessment-flagged word becomes a targeted drill in the EXISTING review
machinery, and the next assessment of that same word shows the before/after
result next to the drill that targeted it. One closed loop on one measurable
variable — the ELSA take documented in `ELSA-SPEAK-RE.md` §2. Not a new
pronunciation screen, not a new scheduler, not a new metric family.

**Non-goals:** phoneme-level scoring claims (A-7 gated); a parallel
scheduler; biometric audio retention (clips are never committed —
`scripts/pron-validation-clips/` stays gitignored); any change to the
`measured:asr-alignment` tier definition or its 23-test battery.

## 2. Current-state inventory (verified in the tree, 2026-10-25)

| Ingredient | Where | Shape |
|---|---|---|
| Word-level measurement | `src/lib/pronunciation.ts` | `PronReport { accuracy, hits, near, misses, total, words: PronWord[], extra[], tier: "measured:asr-alignment", note }`; `PronWord { target, heard, status: "hit"\|"near"\|"miss" }` |
| Assessment API | `src/app/api/speak/assess/route.ts` | POST `{target, audio}` → report; persists **SpeakSession round 0** (read-aloud; monologue = rounds 1/2); rate-limited; Azure-or-fallback honesty; GET exposes the 8 curated Farsi-transfer targets + `azure` flag |
| Drill memory | `src/lib/mistakes.ts` | `recordMistakes(MistakeInput[])` — kind `"speak"` is already legal; family id = `${userId}:${kind}:${tag}`; healing loop (2 clean hits → resolvedAt) exists |
| Scheduling | `src/lib/fsrs.ts` + `CardState` | composite PK `(userId, cardId)`; `dir`, `suspended`, due index — the queue the drills must land in |
| Read-aloud UI | `src/components/rah/ReadAloud.tsx` | renders the report; Sound Lab inference is already labeled as inference (PRON_NOTE) |

## 3. Design — three wires, zero new tables

**Wire 1 · flag → family (dedupe by construction).** After `scorePronunciation`
returns, every `PronWord` with `status: "miss" | "near"` becomes a drill
candidate. For each candidate, upsert ONE MistakeFamily per user+word:
`kind: "speak"`, `tag: "pron_" + normalizeTag(word)` (the existing
`normalizeTag` bounds it to 40 chars), `label: "Pronunciation: <word>"`,
`evidence: "heard '<heard>' — target '<target>'"` (heard may be null →
"not recognized"). The deterministic id makes replays idempotent: a retry of
the same assessment bumps `count` and refreshes `lastSeen`, never duplicates.
The family's existing healing loop is the loop-closure semantics for free:
two clean re-assessments retire it; a fresh miss reopens it.

**Wire 2 · family → FSRS drill (existing paths only).** A drill is a normal
review card with `cardId: "pron:<word>"`, created through the SAME card
creation path MaterialCard uses (provenance-tagged, same queue, same
GradeAck dedupe). The card's front is the word in a minimal carrier sentence
from the assessment target; the review grade path is untouched. Enqueue rule:
only when no live `CardState` row exists for that cardId (a resolved family
reopening re-enqueues; an active drill does not duplicate). The drill carries
the family id as provenance, so Mind Reader corrections and the evidence
panel keep working unchanged.

**Wire 3 · re-measure → before/after (derived, not stored).** When a
round-0 assessment contains a word that has (or had) a `pron_*` family, the
response gains a `loop` object derived from prior SpeakSession round-0 rows
of the same user (scan capped at the last 50, parsed from the persisted
result JSON — small data, no new table):

```jsonc
// added to the assess response when the target contains a drilled word
"loop": {
  "word": "thirty-three",
  "familyTag": "pron_thirty_three",
  "prior": { "accuracy": 33, "at": "2026-10-18T09:00:00Z", "status": "miss" },
  "current": { "accuracy": 100, "status": "hit" },
  "delta": 67,
  "drillState": "active | resolved | reopened",
  "tier": "measured:asr-alignment"   // copied from the reports — never upgraded
}
```

The UI renders it as one honest line: "thirty-three: 33% → 100% across two
reads (word-level measurement)". If the sample is 1, the line says so. If
Azure is configured AND A-7 has passed, phoneme data may annotate WHICH
sound inside the word — the word-level numbers and their tier label never
change (no tier mixing).

## 4. Rules the tests must pin

1. **Flagged-word mapping**: miss + near words map to `pron_*` families;
   hits never create families.
2. **Duplicate prevention**: replaying the identical assessment (and a
   concurrent double-POST) yields exactly one family and one card.
3. **Same-target linkage**: `loop.prior` is the LAST prior round-0 report
   containing the word; `delta` is arithmetic, not vibes; absent prior →
   no `loop` object (not a null-filled one).
4. **User isolation**: family id + cardId + the session scan are all
   user-scoped; user B's drilled word never appears in user A's `loop`.
5. **Offline/retry**: offline assessment still refuses honestly (no new
   offline surface); an offline ENQUEUED drill reviews and replays through
   the existing outbox/GradeAck path; retry-after-5xx never double-counts.
6. **Absent/invalid Azure credentials**: the loop behaves IDENTICALLY on
   the built-in tier; an Azure mid-call failure falls back and the report's
   own tier label flows through every stored artifact.
7. **Honest fallback**: no code path may display a phoneme claim, a
   "mastered" label, or a tier other than the report's own.
8. **No score-tier mixing**: `loop.tier` is copied from the measured
   reports; a future validated phoneme tier may coexist but never overwrite
   or blend with word-level numbers in the same rendered number.

## 5. Test plan (deterministic; extends the pronunciation + isolation batteries)

| # | Case | Pin |
|---|---|---|
| T1 | flag mapping | 2 miss + 1 near words → exactly 3 `pron_*` families, 3 cards, 0 families from hits |
| T2 | replay idempotency | same report recorded twice → count 2, one family, one card |
| T3 | concurrency | two simultaneous identical POSTs → one family, one card (unique-id catch) |
| T4 | linkage | prior miss then hit → `loop.delta` exact; three priors → last one used |
| T5 | no-prior shape | first-ever assessment of a drilled word → no `loop` key |
| T6 | isolation | users A/B same word → disjoint families/cards/loops |
| T7 | offline replay | enqueued drill graded offline, replayed post-reconnect → one GradeAck, one review row |
| T8 | azure-less honesty | `azureSpeechConfigured() === false` path → identical loop behavior, tier label `measured:asr-alignment` in every persisted artifact |
| T9 | tier mixing | a mocked "validated" report injected → word-tier numbers unchanged; battery asserts the label guard |
| T10 | healing | two clean re-assessments → family resolvedAt set; drill suspended, not deleted |

## 6. Acceptance criteria (when the gates clear)

- All 10 cases green in the pronunciation battery family; full battery,
  tsc, lint, prod E2E, CI green.
- The assess response and ReadAloud UI show the loop line with the tier
  label; no new surfaces claim phoneme measurement.
- `ELSA-SPEAK-RE.md` §4 P-1 row updated from "missing wire" to "shipped,
  evidence"; backlog Part B/C rows updated with the battery counts.
- Nothing biometric committed: the E2E uses synthetic WAV fixtures.

## 7. Human inputs still required before implementation

1. A-1 closure — the account holder chose a **fresh-repo migration**
   ("later"; checklist ready in `FRESH-REPO-MIGRATION.md`). The privacy P0
   stays open, and this plan stays implementation-gated, until the old
   repo's exposure is actually gone (the daily sweep says so).
2. ~~A-2 database decision~~ **SIGNED — Option B (PostgreSQL), Task 97;
   A-3 cutover executed.** The loop's data contract is engine-neutral and
   now runs on PG.
3. ~~Azure key + clip set~~ **OBSOLETE (Task 97 $0 directive).** Azure is
   de-escalated to a reference-comparison harness only; **Task 98: the local
   OpenPronounce sidecar is REJECTED by the standing lightweight rule**
   (2.4 GB weights + 2–3 GB RAM on a ~4 GB box) — there is NO phoneme
   provider now; any future tier must be a lightweight $0 API candidate
   passing the human-rated benchmark gate (`OPENPRONOUNCE-AUDIT.md` §1
   supersession, backlog A-7). The word-tier loop itself needs nothing and
   ships first either way.
