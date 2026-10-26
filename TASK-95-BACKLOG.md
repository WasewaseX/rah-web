# TASK-95-BACKLOG — prioritized engineering and product roadmap, made executable

Written 2026-10-24. This is the external reviewer's six-section roadmap
turned into a backlog with acceptance criteria, regression tests, and an
explicit human-gate ledger — per their closing offer: "prioritized issues,
acceptance criteria and specific regression tests for each change."

Reading guide:
- **Status** values: `DONE (Task 95)` / `IN PROGRESS` / `READY` (agent can
  start) / `HUMAN GATE` (requires the account holder's hands or decision) /
  `BLOCKED` (waiting on another item).
- Every item names its regression test — a change that cannot name its test
  does not ship (house rule since Task 62).
- No feature work starts while a P0 in Part A is open (the reviewer's
  central recommendation, adopted as doctrine).

## Standing rules (account holder directives — bind every task)

1. **LIGHTWEIGHT, ALWAYS (2026-10-26, verbatim: "no do not make things heavy
   at all always remember this rule make things lightweight and only use apis
   to avoid render fails")** — the deployment box has ~4 GB total RAM; nothing
   that downloads multi-GB weights, runs a GB-scale inference sidecar, or
   bloats the client bundle may ship. Heavy work happens behind APIs (server
   routes), never in the browser and never as a resident local model. Any
   proposal that adds resident RAM beyond the app+PG baseline is rejected by
   default.
2. **Strict $0** — no paid API, no trial-dependent feature, no metered
   subscription (Task 97 directive, unchanged).
3. Claims-vs-diff audit gate — every "shipped" claim is verified against the
   actual tree.

---

## Part A — the ten critical fixes

### A-1 · P0 · Finish the GitHub privacy purge — `SUPERSEDED (Task 97): fresh-repo migration chosen by the account holder` + `DONE (Task 95)` (everything around it)
- **Task 97 decision (account holder, verbatim)**: "its okay we will just make a fresh repo but later" — the Support-purge route is replaced by a **fresh repository migration**, planned end-to-end in `FRESH-REPO-MIGRATION.md` (orphan-history start so no pre-scrub object ever re-ships, 8-step checklist, closure criteria, 30-day archive-then-delete of the old repo). `PRIVACY-PURGE-REQUEST.md` stays in the tree as the fallback route; the daily sweep + alert layer keep monitoring until migration closes the exposure (still 15/16 dangling + blob served as of 2026-10-25).
- **Outcome**: old commit objects stop being anonymously retrievable; the
  cached db blob is evicted; the daily sweep returns 0/16 clean twice.
- **Task 95 shipped**: the ready-to-file request —
  `PRIVACY-PURGE-REQUEST.md` (tracked, recycle-proof) with all 15 dangling
  SHAs in FULL 40-char form (10 resolved locally, 5 via the public atom
  feed — which is itself fresh retrievability evidence), the blob's three
  evidence URLs, and the closure criteria. Copy at
  `download/GITHUB-SUPPORT-PURGE-REQUEST.md`. Fresh evidence 2026-10-24:
  raw CDN serves the blob with HTTP 200; sweep 15/16 + blob-still-served.
- **Acceptance**: `scripts/privacy-sweep.py` exits 0; the raw URL 404s; two
  consecutive daily sweeps clean (the alert layer fires an INFO the day it
  happens — impossible to miss).
- **Regression test**: the daily sweep itself (watchdog tick) + sweep-state
  change alert. **Who**: the ACCOUNT HOLDER files the request (nobody else
  can — Support requires account identity).

### A-2 · P0 · Make the production database decision — `SIGNED (Task 97): Option B — PostgreSQL`
- **Account holder's decision, 2026-10-25, verbatim**: "if its possible postgreSQL" — PostgreSQL for multi-user readiness and production growth. Registration stays LOCKED (the engine choice and the unlock decision are separate gates; the unlock remains the account holder's call after the acceptance checks below).
- **Everything the decision needs is packaged**: `PG-DECISION.md`
  (Option A/B framing), `scripts/pg-cutover.sh` (dry-run default, guarded
  `--flip`, proven rollback), the 30-table rehearsal GREEN (counts +
  checksums + backup/restore), and the reviewer's constraint: "Do not
  unlock public registration before the production migration and recovery
  tests are complete."
- **Acceptance**: one line appended to `ROADMAP-STATUS.md`: "Decision:
  Option A/B, signed by the account holder, date." **Regression test**:
  if B — the full isolation battery must pass against the PG URL before
  any unlock (the suite already runs a throwaway stack; adding a PG URL
  profile is a listed task under D-1).

### A-3 · P0 · PostgreSQL production cutover — `DONE (Task 97)`
- **Executed 2026-10-25** via `pg-cutover.sh --flip` (guarded, double-confirm, `.env` + schema backups timestamped): live learner data copied SQLite→PG verified 30/30 counts + checksum (xp=475 at flip time), provider switched, client regenerated, standalone rebuilt, PG baseline migration history (SQLite history preserved aside).
- **Acceptance PROVEN**: boot regression ALL PASS on PG (state 200 + coach streaming); main battery **441/441** on a throwaway PG database (battery made engine-agnostic); isolation battery **47/47** on PG (converted to psql seeding; the coach-stamp check tightened to pin the user-role row — the reply sometimes echoes the probe text, a model-echo flake, not an isolation break); guard 58/58 (SQLite rollback chain untouched); email battery 7/0/1 on PG.
- **Survival layer (the recycle class is real: recycle #8 killed the Task-74 PG env)**: `scripts/pg-survival.sh` (ensure = start-or-restore with CRITICAL alert; dump = daily pg_dump with Session/LoginCode ROWS excluded (REG-2 port) + sidecar counts JSON → db/backups (keep 14) + upload/rah-backups + vault; verify = weekly restore drill). Wired into ensure-server (boot), watchdog (daily dump + weekly drill), vault-sync (dump ships). **Recycle drill PROVEN live**: PG stopped + data dir wiped → ensure restored from the upload dump → app green (xp intact, tripwire intact) with the CRITICAL alert recorded.
- **Freshness chain extended**: `freshness-check.py` now has a PG branch — LIVE = PostgreSQL primary, snapshot legs = the dump sidecars (4-way MATCH verified: LIVE=SYNC=VAULT=UPLOAD xp=483).

### A-4 · P0 · Make pilot measurements survive recycling — `DONE (Task 95)`
- **Outcome**: the weekly pilot series can no longer be destroyed by an
  environment recycle (it was lost in recycles #6 AND #7 — the reviewer
  flagged the exact gap).
- **Shipped**: `vault-sync.sh` now restores `db/pilot/series.md` from the
  private vault when missing (boot + daily cadence, both directions
  proven by a byte-identical round-trip test), cold-start seeding, ENC
  support, and the watchdog's weekly append now runs BEFORE the vault
  push so a fresh checkpoint ships the same day. The alert layer + the
  alerts digest give the series an audit trail offsite.
- **Acceptance**: delete `db/pilot/` → next vault-sync restores it; a
  recycle followed by boot leaves the series intact. **Regression test**:
  the round-trip (delete → restore → `diff -q` identical), re-runnable by
  hand; the vault holds `rah-web/pilot/series.md` from commit b38fe69 on.

### A-5 · P1 · Remove dependence on ephemeral workspace state — `IN PROGRESS` (drift + alerts done incl. Task 95-b's fourth state; immutable-deploy hardening remains)
- **Outcome**: recycles become non-events: prod-preferred boot (done,
  Task 89), drift detection (done, Task 95 + 95-b — all FOUR states:
  missing prod build CRITICAL, dev-serving while prod exists WARN, build
  != intended release WARN, running process predates HEAD WARN),
  watchdogs outside the workspace lifecycle (ensure-watchdog self-start,
  done), alert on served-build != intended release (done).
- **Task 95 shipped, with a live catch**: on 2026-10-24 the recycle wiped
  `.next/` and boot silently fell back to `next dev`; the new
  `deploy-drift-check.sh` fired CRITICAL, `build-prod.sh` now records
  `backups/.intended-build-id`, and `ensure-server.sh` flips a
  dev-serving state to the release build instead of accepting "healthy".
  Prod build `2pW8kL9VVbfgQsn8nUCwz` == intended; drift OK.
- **Task 95-b amendment (reconciled into this backlog 2026-10-25)**: a
  fourth drift state was found live and closed — the 15:11 standalone kept
  serving `038dc4c` after `e4527ec` landed (every health check green, the
  /api/version doctrine unenforced). Check 4 now compares served
  `/api/version` .version vs git HEAD (WARN; auto-restart deliberately NOT
  added — alert-without-flapping is the contract, restarts stay
  deliberate). Verified live: WARN fired with both SHAs, restart served
  HEAD, drift FULLY OK.
- **Remaining**: build once, deploy the artifact (copy the standalone dir
  rather than rebuilding in-place) — acceptance: a fresh recycle restores
  the EXACT intended BUILD_ID without a new build. **Regression test**:
  `deploy-drift-check.sh` (exit 0 after a true restore; CRITICAL when
  `.next/BUILD_ID` is missing).

### A-6 · P1 · Complete transactional email configuration — `CONFIGURED (Task 97): transport verified; one input remains`
- **Task 97**: the account holder provided a Resend API key (sending-only restricted key — verified: read endpoints 401 by design). Fetched and followed resend.com/setup.md + send-with-smtp.md: SMTP bridge (`smtp.resend.com:465`, user `resend`, TLS implicit) wired into the EXISTING nodemailer contract via `.env` (gitignored; key never committed, never logged, never in frontend). Sender identity `onboarding@resend.dev` (no custom domain). **Transport PROVEN without spending quota**: `scripts/smtp-verify-once.ts` (nodemailer verify() = connect+TLS+AUTH, zero mails) → OK. Email battery re-run on a throwaway PG database with SMTP mocked off: **7 pass / 0 fail / 1 honest skip** — the ledger contract is engine-proof.
- **Remaining input**: `MAIL_TEST_TO` = the account holder's real address for the ONE live verification send (free tier: 3,000/mo, 100/day; sends only to the account email until a domain is verified). Tests stay mock-by-default per the $0 rule.
- **Outcome**: real SMTP/provider configured; verification, failure,
  retry, and duplicate-suppression behavior validated in that mode.
- **Task 95 shipped**: `EMAIL-OPERATIONS.md` (Resend/Gmail runbooks, SPF/
  DKIM note, the four validation steps) + `scripts/test-email-delivery.ts`
  battery: 7 pass / 0 fail / 1 honest skip (real-send needs credentials).
  The ledger contract (sliding 60s idempotency window, one row per
  recipient, `status=sent|failed|dev`, provider messageId) is pinned.
- **Acceptance**: battery green WITH SMTP configured and a real send
  received; a deliberate wrong-password run records `failed` and surfaces
  a speakable error. **Regression test**: the battery itself.

### A-7 · P1 · Validate the phoneme-level pronunciation tier — `CLOSED (Task 98): local tier REJECTED by the standing lightweight rule; word-level tier is the validated tier`
- **Task 98 closure (account holder directive, verbatim: "no do not make things heavy at all always remember this rule make things lightweight and only use apis to avoid render fails")**: the OpenPronounce local tier is REJECTED for this deployment — two ~1.2 GB checkpoint downloads + a ~2–3 GB RAM inference sidecar cannot fit beside the app + PostgreSQL on the ~4 GB box without starving the server (the exact render-failure class the rule exists to prevent). The audit (`OPENPRONOUNCE-AUDIT.md`) stays in the tree as the verified reference; its verdict section records the supersession.
- **Resulting policy**: the ONLY validated pronunciation measurement is the existing word-level `measured:asr-alignment` tier (server-side, zero added RAM) + its 23-test battery. Azure remains reference-only (`azure-pron-validate.ts`). A phoneme tier may return ONLY as a lightweight $0 API candidate (no resident model, no multi-GB download) and would still ship as `experimental:local-phoneme` behind the human-rated benchmark gate of `PRONUNCIATION-VALIDATION.md`.
- **Account holder's $0 directive (Task 97, unchanged)**: no paid API may be required for normal operation; Azure at most for an explicitly approved reference comparison.
- **OpenPronounce audit retained as reference** (`OPENPRONOUNCE-AUDIT.md`, shallow-clone-verified): MIT, maintained, 60+ weight-free tests, honest self-documented error rates — technically sound, too heavy for THIS box. If a future box with headroom exists, the audit is the restart point.
- **Outcome**: phoneme-level feedback validated against real recordings
  BEFORE any UI claim (the review's exact wording).
- **Task 95 shipped**: `PRONUNCIATION-VALIDATION.md` (7 acceptance
  criteria, clip set, post-validation claim-flip rules) +
  `scripts/azure-pron-validate.ts` (mirrors the adapter's REST contract;
  honest SKIP without a key — verified; exits 1 on any failed criterion).
  The word-level `measured:asr-alignment` tier and its 23-test battery are
  untouched and remain the fallback.
- **Acceptance**: harness ALL CHECKS PASS with key + clips; then, and only
  then, the UI may label the Azure tier. **Regression test**: the harness
  + the existing degradation pins.

### A-8 · P1 · Test offline behavior on physical devices — `READY` (protocol shipped; execution needs a physical phone)
- **Outcome**: airplane mode, reconnects, duplicate replays, browser
  closure, storage eviction, and account switching verified on real
  hardware — the browser E2E cannot represent real radios.
- **Task 95 shipped**: `OFFLINE-TEST-PROTOCOL.md` — 7 scenarios, each with
  steps, expected outcomes, and the code contract it exercises
  (`rah-outbox-v1` gid/GradeAck dedupe, the 4xx-drop rule, the refuse-
  offline honesty rule, the outbox cap), plus a results-recording route
  into the vault-backed pilot series.
- **Acceptance**: 7/7 PASS recorded with device model + OS + browser;
  any FAIL becomes a backlog entry named by its scenario number.
  **Regression test**: scenario 2 (duplicate replay) is the candidate for
  automation into the existing E2E family afterward.

### A-9 · P1 · Run a real multi-week learner study — `IN PROGRESS` (instrumentation + cadence automated; only weeks of real use can finish it)
- **Outcome**: measured retention, writing, listening, speaking deltas over
  multiple weeks — E2E activity is not educational evidence (reviewer's
  words, adopted as doctrine).
- **Standing state**: weekly checkpoints append automatically to the
  vault-backed series (Task 92-bis automation + Task 95 durability);
  writing/speaking volumes are honestly zero until the learner produces
  volume; the series labels every small-sample week as such.
- **Acceptance**: ≥4 consecutive weekly checkpoints with non-zero writing
  and speaking volumes; retention trend computable across ≥3 weeks with
  ≥30 first attempts each. **Regression test**: `pilot-metrics.mjs`
  output shape pinned by the battery.

### A-10 · P1 · Add alerts for data-integrity and monitoring failures — `DONE (Task 95)`
- **Outcome**: the failure classes the review listed — freshness-chain
  mismatch, unexpected zero activity, failed backup pushes, restore
  failures, watchdog disappearance — surface as events, not buried lines.
- **Shipped**: `scripts/alert.sh` (append-only `db/alerts.log`, never
  fatal) wired into: watchdog site-DOWN/recovery, db-integrity repair
  firings, vault clone/push failures, daily freshness-chain check
  (LIVE=SYNC=VAULT=UPLOAD + scrub), deployment drift, and privacy-sweep
  STATE CHANGES (dangling count moves, blob flips, the CLEAN day). The
  digest ships to the private vault (`rah-web/alerts/recent.log`), so
  alert history survives recycles too. Watchdog disappearance is covered
  structurally: ensure-server's boot path re-runs ensure-watchdog, and a
  dead watchdog is exactly the condition A-5's drift check + the recycle
  recovery chain now surface at next boot.
- **Acceptance**: each wire-in demonstrated (the live dev-fallback catch
  is recorded in the digest). **Regression test**: kill the server →
  watchdog revive + CRITICAL alert row; corrupt freshness → CRITICAL row.

---

## Part B — the ten critical features (NO implementation while a Part-A P0 is open)

| # | Feature | Acceptance criteria (measurable) | Regression test | Status |
|---|---|---|---|---|
| F-1 | Validated phoneme-level pronunciation feedback | **PARKED (Task 98, lightweight rule)**: no candidate fits the ~4 GB box; if a lightweight $0 API candidate appears, it must pass the human-rating benchmark before any UI claim; word-level and phoneme tiers never merged in metrics; `experimental:local-phoneme` label until then | PRONUNCIATION-VALIDATION.md benchmark gate + tier-mixing pins | `BLOCKED on a lightweight $0 candidate` (audit reference: OPENPRONOUNCE-AUDIT.md) |
| F-2 | Expert-calibrated exam scoring | band RANGES with uncertainty + sample size on every exam result; calibrated against ≥20 human-rated responses; no false-precision band numbers | battery pin on the uncertainty shape; rubric battery | `READY` — design + contract in `MAGOOSH-PLAN.md` §5/§8 (Task 96); implementation gated |
| F-3 | Cross-device draft sync | server-side draft store, version history, conflict resolution, explicit consent before grading submit; local autosave keeps working offline | writing battery + new sync battery; offline protocol S4/S5 re-run | `READY` (A-2 done Task 97 — PostgreSQL is the store; schema work unblocked) |
| F-4 | Structured listening library | graded B2–C1 audio, multiple accents, transcripts, replayable segments, comprehension items; skill-deltas (not play counts) land in DailyStat | provenance battery extends to audio sources; listening battery | `READY` |
| F-5 | Voice-shadowing mode | listen→imitate→compare→retry loop; recurring errors auto-link to review cards; uses the same measured tier labels as read-aloud | pronunciation battery extension | `READY (A-7 closed Task 98)` — the word-tier loop needs no phoneme tier; the goal-bound session wrapper it joins is designed in `SPEAK-PLAN.md` (Task 96) |
| F-6 | Farsi-specific transfer-error explanations | content built from REVIEWED learner examples (mistake memory), minimal contrasts + follow-ups; every explanation cites its evidence pattern | mistake-memory battery; content review checklist | `READY` |
| F-7 | Broader document/web import | PDF/EPUB/article import with source attribution preserved, extraction-failure detection, learner-selected passages before exercise generation | pdf-engine battery + provenance battery extension | `READY` |
| F-8 | Expression/collocation training | multi-word items as first-class cards; register + phrasal patterns; FSRS revisits them in varied contexts | fsrs parity battery with multi-word items | `READY` — seed content + selection contract in `SPEAK-PLAN.md` §3.1/§3.2 (Task 96); implementation gated |
| F-9 | Optional human tutor review | permission-controlled sharing of SELECTED attempts; tutor comments stored separately from AI grading, labeled at render | isolation battery (new sharing scope tests) | `READY` (A-2 done Task 97 — sharing scopes design on PG) |
| F-10 | Versioned curriculum/content release | versioned items + prerequisites; content-quality tests run before publish; history preserved to explain any past assignment | curriculum battery + new version-pin test | `READY` |

## Part C — the ten polish items (improve value/explainability/resilience of shipped features)

| # | Surface | Meaningful polish | Regression test | Status |
|---|---|---|---|---|
| C-1 | Review queue + FSRS | "why due now" explanation, new-vs-revision distinction, scheduling confidence, full-queue recovery test | fsrs parity battery + new explanation-shape pin | `READY` |
| C-2 | Talk conversation mode | interruption handling, mic recovery, typed fallback, mobile-browser behavior, session recording | e2e talk extension | `READY` |
| C-3 | Sound Lab | measured word-level vs inferred sound-contrast clearly separated; confidence + replayable examples; phoneme scoring only after A-7 | pronunciation 23-battery labels | `READY` |
| C-4 | AI coach + agent | evidence panel: which tools ran, what changed, what failed, how to resume a stopped task | agent battery extension | `READY` |
| C-5 | Exam generation/grading | more benchmark questions, distractor-plausibility tests, rubric calibration vs human-rated answers | fuzzy/grading batteries | `READY` |
| C-6 | CEFR placement/progress | skill-specific sample counts + uncertainty + history; no C1 claims off small samples | ladder battery + shape pins | `READY` |
| C-7 | Mistake memory/mastery | exact evidence per recurring weakness; learner correctable; per-error decline measured over time | mistake-memory battery | `READY` |
| C-8 | XP/gems/quests/games | rewards tied to measured practice; anti-farming retained; progress possible without constant gamification | arcade/goal batteries | `READY` |
| C-9 | Writing workspace | cross-device drafts (F-3), clearer rubric explanations, before/after measurable deltas | writing 31-battery | `READY` |
| C-10 | Progress dashboard/pilot | activity vs test-events separation, sample sizes shown, "insufficient evidence" explicit states, durable checkpoints (done via A-4) | e2e progress + series-shape pin | `READY` |

## Part D — the three data stores (timing depends on A-2)

| # | Store | Take only when | Acceptance | Status |
|---|---|---|---|---|
| D-1 | PostgreSQL (primary) | A-2 decides Option B, or multi-user | A-3's criteria + isolation battery on PG | `DONE (Task 97)` as single-node userspace PG (flip + survival layer + recycle drill proven); managed-hosting move remains optional future work |
| D-2 | Redis/Valkey (shared operational state) | >1 app instance must agree (rate limits, locks, cache) | never authoritative for FSRS/XP/progress; single-node in-process controls stay | `NOT NEEDED` in the single-learner era |
| D-3 | R2/S3 (private object storage) | hosted durable files (docs, audio, reports) beyond the workspace | metadata+checksums+ownership in the DB; contents in object storage; REG-2 rules extended to it | `READY after A-1 closes (Task 97: closure = the fresh-repo migration)` — do NOT let it postpone the migration |

## Part E — the three APIs

| # | API | What to do | Acceptance | Status |
|---|---|---|---|---|
| E-1 | LLM API (structured outputs + tool calling) | improve evals, cost controls, retries, deterministic validation; NO new provider | eval suite for coach/writing/quiz outputs; cost log per day | `READY` |
| E-2 | Azure AI Speech pronunciation assessment | **DE-ESCALATED (Task 97, $0 directive; Task 98 confirms)**: reference-comparison harness only (`azure-pron-validate.ts`); never required for operation; there is NO production phoneme path — the word-level measured tier is the production measurement | PRONUNCIATION-VALIDATION.md gates + the degradation pins | `REFERENCE-ONLY (dormant without a key)` |
| E-3 | Transactional email | **CONFIGURED (Task 97)**: Resend SMTP bridge via the existing nodemailer contract; key server-side only; tests mocked by default; free tier, no overages | battery 7/0/1 on PG + transport verify OK; one live send when MAIL_TEST_TO exists | `DONE (Task 97)` (final live-send check pending the address) |

---

## Execution order (the review's four phases, adopted)

1. **Security and durability** — A-1 filing (human), A-4 ✅, A-5 (drift ✅ /
   artifact-deploy remaining), A-10 ✅.
2. **Production architecture** — A-2 decision (human) → A-3 only if B.
3. **Learning quality** — A-6, A-7, then F-1/F-5/F-2/C-3/C-5.
4. **Evidence of improvement** — A-9 continues weekly; features F-* queue
   ONLY behind open Part-A P0s.

## Task 95's own claim ledger (audited against the tree at commit time)

| Claim | Proof to find in the tree |
|---|---|
| Pilot history is vault-backed, both directions | `scripts/vault-sync.sh` pilot section; vault commit b38fe69 contains `rah-web/pilot/series.md`; round-trip diff identical |
| Purge request filed-ready | `PRIVACY-PURGE-REQUEST.md` (15 full SHAs) + `download/GITHUB-SUPPORT-PURGE-REQUEST.md` |
| Drift detection + intended-release record | `scripts/deploy-drift-check.sh`, `scripts/build-prod.sh` record write, `backups/.intended-build-id` == `.next/BUILD_ID` |
| Alert layer wired | `scripts/alert.sh` + wire-ins in `watchdog.sh`/`ensure-server.sh`/`vault-sync.sh`; `db/alerts.log` rows incl. the live dev-fallback catch; vault digest `rah-web/alerts/recent.log` |
| Offline/pron/email validation packs | `OFFLINE-TEST-PROTOCOL.md`, `PRONUNCIATION-VALIDATION.md` + harness, `EMAIL-OPERATIONS.md` + battery (7/0/1) |
| Three RE docs | `ELSA-SPEAK-RE.md`, `SPEAK-RE.md`, `MAGOOSH-IELTS-RE.md` |

---

## Task 96 reconciliation (2026-10-25) — the reviewer's two explicit asks, closed with evidence

The newest review (8.9/10 overall, 9.6/10 engineering, 7.0/10 production
readiness) asked for two reconciliations before treating the three RE-doc
prompts as executable feature tasks. Both are closed here, evidence-first:

1. **CI has run against the latest commits — confirmed.** The reviewer's
   caveat: "the public Actions page I could inspect still lists CI Run #117
   for Task 94 as its latest visible run." The anonymous Actions API
   (checked 2026-10-25) shows: **Run #118 = `e4527ec` (Task 95), Run #119 =
   `27587a8` (Task 95-b), Run #120 = `b89d4ea` (95-b worklog) — all
   `completed success`.** The reviewer's page was a visibility lag, not a
   missing run. This reconciliation's own push triggers the next run,
   recorded in ROADMAP-STATUS.md §17.
2. **Task 95-b drift-check completion reconciled with this backlog.** A-5
   above now names all four drift states and carries the 95-b amendment
   paragraph (found live: served `038dc4c` while HEAD was `e4527ec`;
   check 4 = served-version-vs-HEAD, WARN, no auto-restart by design).
   Previously A-5 named only the three Task 95 states — the backlog was
   one amendment behind the code.

Also shipped under the reviewer's standing rule ("while P0 human gates
remain open, do documentation, architecture, and test preparation only; do
not ship new feature code"): the three RE prompts are now **implementation
plans** — `ELSA-PLAN.md` (P-1 loop: flag→family→FSRS drill→before/after,
data contract, 10 tests), `SPEAK-PLAN.md` (T-2/T-3/F-5: scenario library,
earned difficulty gate, exit receipt contract, 10 tests), and
`MAGOOSH-PLAN.md` (T-8/T-9/F-2: versioned track docs, item explanation
contract, band-range + calibration-gate contract, 10 tests). Each plan
names its human inputs; none ships code while a P0 is open. The RE docs
carry §6 pointers to their plans so the next implementation session starts
at a contract, not at research.

---

## Task 97 ledger (2026-10-25) — decisions executed: PG flip, Resend, $0 speech, fresh-repo plan

| Claim | Proof to find in the tree / environment |
|---|---|
| A-2 signed: Option B (PostgreSQL) | this file §A-2 (verbatim account-holder quote); PG-DECISION.md §3 runbook executed |
| A-3 cutover DONE + proven | `.env` DATABASE_URL postgresql; prisma/schema.prisma provider postgresql; PG baseline migration history; batteries: 441/441 + 47/47 + 58/58 + email 7/0/1; boot regression ALL PASS on PG; `/api/version` xp=483 tripwire intact |
| PG survives recycles | `scripts/pg-survival.sh` (ensure/dump/verify) wired in ensure-server + watchdog + vault-sync; dump excludes Session/LoginCode rows (REG-2 port); sidecar JSONs feed freshness; LIVE recycle drill: data dir wiped → auto-restore → app green + CRITICAL alert |
| Freshness chain PG era | `scripts/freshness-check.py` PG branch: LIVE=PG, legs=db/backups + vault + upload sidecars — 4-way MATCH verified |
| Resend configured, $0-safe | `.env` SMTP_* (gitignored; key never committed); `scripts/smtp-verify-once.ts` transport OK (zero mails sent); battery 7/0/1 on PG throwaway with SMTP mocked; MAIL_TEST_TO = the one remaining input |
| $0 speech policy adopted | `OPENPRONOUNCE-AUDIT.md` (clone-verified findings + integration shape + costs); Azure de-escalated to reference-only (E-2); word tier untouched |
| Lightweight rule adopted (Task 98) | Standing rules block above; OpenPronounce local tier rejected for this box (A-7); boot scripts source .env on every road; PG survived the reprovision via the Task 97 dump |
| Fresh-repo migration planned | `FRESH-REPO-MIGRATION.md` (8-step checklist + closure criteria); A-1 status SUPERSEDED; sweep monitoring continues |
| CI proves PG | `.github/workflows/ci.yml`: postgres:17 service + `db:deploy` of the PG baseline + lint + tsc |
| Batteries engine-agnostic | `scripts/test-isolated-battery.sh` (PG throwaway rah_battery, drop/create per run); `scripts/test-isolation.sh` (PG psql seeding; coach-stamp check tightened to the user-role row against model-echo flakes) |
