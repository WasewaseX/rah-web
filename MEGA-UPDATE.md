# Mega-Update Spec — "Close Every Loop" wave

Written 2026-10-18 after Task 28 (quota enforcement + placement resilience). The app's
promise chain inside a single surface is now enforced end to end: exam count, answerability,
focus, weakness quota, placement completion — all deterministic. This wave attacks the
loops that still END at the surface boundary: knowledge proven (or broken) in one place
that never reaches the machinery that schedules, generates, or reminds.

Every pillar below is grounded in a verified gap (grep-level evidence, not vibes), carries
a gate that must pass live before the pillar is called shipped, and follows the house
rules: engine decides, AI words it; every promise enforced by machinery; drives restore
state; no slop.

Status tracker: `[ ]` todo, `[~]` in progress, `[x]` shipped with gate green.

---

## P1. Exam↔FSRS unification — "the schedule knows" `[x] a6299f7`

**Gap (verified).** `api/exam/grade` feeds `TagMastery`, `MistakeFamily`, and
`updateSkillLevelsFromExam`, then stops. It never touches `CardState`. A vocab item the
learner bombs in an exam does not pull the matching card due sooner; an item they prove
does not extend anything. The FSRS scheduler only hears the review route. Exam-verified
knowledge is invisible to the schedule — the single biggest loop still open.

**Spec.**
- After grading, for every item with tags, resolve a target card: first a real deck card
  whose headword matches the item's key token (deterministic match against the deck);
  otherwise a synthetic card in the `exam:<tag>:<slug>` namespace.
- Write the outcome through the same FSRS pipe the review route uses (`review()` from
  `src/lib/fsrs.ts`) with an honest grade mapping: confident-correct → 4, correct → 3,
  wrong → 1. `ReviewLog` rows carry `source: "exam"` provenance so stats can separate
  scheduled reviews from exam-verified outcomes.
- The queue builder needs zero changes — it already reads `CardState.due`; exam-written
  states flow into the daily queue naturally.
- Anti-double-punish guard: an exam miss on a card due today that the learner then grades
  in review the same day must not count twice against the arcade miss register (dedupe
  by cardId + dayIndex).

**Gate.** Drive: sit an exam, bomb a known vocab item → the resolved card's `due` moves
into today and `lapses` increments; prove a correct item on a due card → interval extends;
`ReviewLog.source` shows `exam`; next queue build surfaces the bombed card; state fully
restored. Regression battery stays green.

## P2. PWA + habit loop — "installable, unbrappable" `[x] 2e42115`

**Gap (verified).** No `manifest.json`, no service worker, no notifications anywhere in
`src/`. The Tauri v2.0.0 build was installable; the web app lost installability, offline
grace, and any reminder surface. The habit loop (daily goal, streak, freezes) has no
external trigger.

**Spec.**
- Web manifest + maskable icons + theme color; install prompt surfaced from Home when
  the browser reports `beforeinstallprompt`.
- Service worker: cache-first for the app shell and static assets, network-first for
  `/api/*` with a timeout fallback; offline state renders a graceful shell, never a
  dinosaur. Version the cache by git SHA (the `/api/version` beacon already exists —
  the SW reads it and self-evicts stale caches).
- Notifications, honest scope (no push server, so no lies): when the app is opened with
  reviews due or a streak at risk, request permission once and schedule a local
  notification via the SW registration; a "remind me in N hours" nudge tied to the
  next-best-action engine's top move.
- iOS reality documented in-app (no SW notifications there); Android/Chrome desktop get
  the full path.

**Gate.** Manifest served at root, SW registered and cache hit proven on a cold reload
with network cut (drive: offline reload renders shell, `/api/state` falls back gracefully),
install prompt fires, notification permission + fire + click-through-to-review proven.

## P3. Content ladder v2 — "placement steers everything" `[x] 9200670`

**Gap (verified).** Exam generation is level-steered (`spec.level`, edge toward C1) and
the daily quiz takes `profile.level`. But Read is six static texts (level displayed,
not used), Listen topics are a static list with no difficulty steering, Speak prompts
are static five, and game pools climb only by weak-tag density.

**Spec.**
- One shared `ladder.ts`: profile level + mastery band → a difficulty envelope
  {cefr, sentence-length band, lexical band, trap density} consumed by every generator.
- Read: passages generated (or ordered) against the envelope; the six static texts
  remain as the A2 anchor set, new generated passages slot above.
- Listen: topic selection and quiz item difficulty take the envelope (B1 gets slower
  speech rate + shorter turns; C1 gets idiomatic density + faster rate on the TTS
  utterance).
- Speak: prompt selection off the envelope; grading strictness scales (B1 graded on
  intelligibility, C1 on register and collocation).
- Games: dungeon floors and gauntlet pools take the envelope as their floor, not just
  weak-tag density.

**Gate.** Drive: force a B1 profile vs a C1 profile → each generator receives measurably
different envelopes; one live generation per surface proves the material actually shifts;
state restored.

## P4. Listening lab v2 — dictation + pronunciation proximity `[x] 6e679c1`

**Gap (verified).** Listen already owns a real 5-step lab (Gist→Decode→Shadow→Transcript
→Final) and Speak scores free talk with trap tags. Missing: typed dictation whose misses
become scheduled targets, and any objective proximity signal in Shadow (today "copy the
rhythm" has no measurement).

**Spec.**
- Dictation mode: sentence-level TTS → typed answer → word-level diff (reuse the fuzzy
  matcher from fuzzy exam grading); missed words map to tags and write through the SAME
  FSRS pipe as P1 (synthetic `listen:<token>` cards) — dictation misses become scheduled
  reviews, not dead-end marks.
- Pronunciation proximity: in Shadow and Speak, compare the ASR transcript against the
  target sentence client-side (token-level similarity), show per-word hits/slips, and
  feed slip-words into the same synthetic card namespace.
- Both surfaces register misses into MistakeFamily under the existing canon
  (lowercase underscores) so the healing loop hunts them.

**Gate.** Live drive: one dictation round with a deliberately mistyped word → synthetic
card created, due today, appears in queue; one shadow round with mumbled speech →
proximity score renders per-word; state restored. ASR-unavailable browsers degrade
honestly (mode hidden, not broken).

## P5. Portability + CEFR map — "the learner owns the state" `[x] df9a170`

**Gap (verified).** The only export is a 1080×1350 battle-card PNG for the group chat.
There is no data export/import of learner state. The CEFR level exists as a string with
no evidence map behind it.

**Spec.**
- `/api/export` → full learner JSON (Learner, CardState, ReviewLog, MistakeFamily,
  TagMastery, SkillLevel, arcade tables, stats) with the same redaction rules the
  Tauri export had (no AI keys, ever — there are none in DB anyway).
- `/api/import` → validated restore with a dry-run diff first ("this will change 412
  cards, 9 families…"), transactional, idempotent by content hash.
- War Room CEFR map: A1→C1 bands, each band showing measured evidence (placement result,
  mastery ledger density, skill-level scores, exam history) — what is PROVEN vs what is
  assumed, colored accordingly. The map reads engine data; the AI may word it, never rate it.

**Gate.** Drive: export → wipe card/family tables → import → state hash identical;
import of a corrupt file rejected with actionable error; CEFR map renders bands from
real rows and marks unproven bands honestly.

---

## Wave order and why

1. **P1 first** — pure backend, closes the highest-value loop, fully drive-provable, zero
   UI risk. The learning-science core.
2. **P2 second** — infra-level, independent of P1, unlocks the habit loop.
3. **P3 third** — touches every generator, needs the envelope stable before P4 builds on it.
4. **P4 fourth** — depends on P1's FSRS pipe and P3's envelope.
5. **P5 last** — pure tooling + a read-only surface; safe to ship when the state shape is final.

Each wave: implement → drive-prove live → regression battery → tsc/eslint clean →
commit → push → beacon check on localhost AND preview (`/api/version` same SHA,
dirty:0) → worklog entry.

---

## D-wave: "Reverse Engineer Duolingo" (DUOLINGO-RE.md) — D1, D2 shipped

**Gap (verified).** The Task-26 reverse-engineering doctrine (differential
gates against reference implementations) had covered our FSRS port and the
writing rule engine, but never the industry reference itself. Duolingo
publishes the HLR reference implementation (MIT) and the 13M-trace dataset
behind the ACL-16 paper — source-level differential testing applies.

**D1 — parity + duel + cross-exam `[x]` gate `scripts/test-duolingo-hlr.ts`.**
`src/lib/hlr.ts` ports their engine 1:1; Part A proves machine-epsilon parity
against their Python (max |Δw| = 1.11e-16, pinned order); Part B retrains all
four of their models on 300k of THEIR OWN traces (HLR beats Leitner and
Pimsleur on mae + cor(h); lexeme pooling confirmed); Part C replays their
traces through OUR FSRS-5 — best absolute recall error of every engine in the
fight (mae(p) 0.0988, vs their full HLR 0.1226), honest information-asymmetry
note where their lexeme pooling wins on half-life correlation.

**D2 — word-bank translate `[x]` gate `scripts/test-bank.ts` 18/18.** Their
signature exercise, rebuilt on our engine: `bank` review direction (cloze +
sent), `src/lib/bank.ts` deterministic tile trays per (card, day) — answer
always buildable, distractors deck-fed, tray capped, day-seeded reshuffle.
Queue attaches tiles; the client builds by tapping; grading is the shared
join-and-normalize; the grade route persists dir=bank into FSRS + ReviewLog.
Full state restore in finally.

**D3 — match-pairs sprint `[x]` SHIPPED (Task 37)** — `src/lib/pairs.ts` deterministic board (mulberry32, due-first, Farsi-deduped) + `PairsGame.tsx` + `/api/arcade/pairs`; every match grades Good via /api/review/grade dir=pairs so FSRS sees the retrieval once; the sprint POST only clamps the aggregate speed bonus. Gate: battery section 6 + browser E2E (board played to completion).
