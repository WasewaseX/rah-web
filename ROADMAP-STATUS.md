# ROADMAP STATUS — the external audit, item by item

**Last updated:** 2026-10-22 · **Source:** the October 2026 external engineering + product audit ("overall: stabilize before expanding") + its 2026-10-22 re-review (7.6/10 overall, 8.6/10 engineering; new P0: learner data must never reach the public repo).
**How to read:** each item carries DONE / PARTIAL / PENDING, with the evidence (task, commit, gate). Battery = `scripts/test-api-battery.ts` (391 checks, run via `bash scripts/test-isolated-battery.sh` on the throwaway stack); portable drive = `scripts/test-portable.ts`; all gates green at time of writing. Combined plan + incident log + checklist: **ROADMAP-AUDIT.md**. Note: two parallel clones both numbered a wave "57" — the Oct-20 clone's 57 = degraded states (P1-7); the Oct-21 clone's 57-bis = data-guard.

---

## 1. Critical things to fix first

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Learner data isolation | **PARTIAL → hole closed** | Task 48 (`0e9100e`): deployment lock — first account claims the deployment, further registrations refused unless `RAH_OPEN_REGISTRATION=1` (audit's sanctioned single-user alternative). Full per-user scoping (userId on every learning model, scoped queries, two-user route tests) = tracked mega-update below. Lock tested 6/6 on a throwaway migrated DB. |
| 2 | Make GitHub CI green | **DONE (re-fixed 2026-10-21)** | Task 45 (`4d4f582`): root-caused the Typecheck failure — `playwright` was an undeclared parent-dir dep; fixed with an optional-dep dynamic import. Task 57: the audit's "branches: ain]" claim was REAL after all (the Task-45 byte-check was wrong or the file re-corrupted) — `on.push.branches` read the literal string `ain]`, so **pushes to main never triggered CI**; now a proper list selector, YAML-validated. Lesson: bracketed YAML values in this workspace can be silently mangled — use list form. |
| 3 | Remove auth token from localStorage | **DONE** | Task 46 (`240100a`): normal login now returns NO browser-readable credential (httpOnly cookie only); embedded callers get a Partitioned SameSite=None cookie (CSRF-guarded by the custom `x-rah-embed` header) with the raw token as last resort stored in **sessionStorage** (dies with the tab); legacy localStorage tokens scrubbed on load. E2E 8/8 in a real browser: top-level = zero tokens in any JS storage; iframe = sessionStorage-only fallback works. |
| 4 | Harden email-code auth | **DONE** | Task 46 (`240100a`): codes stored as sha256 hashes (plaintext memory-only), atomic single-use consume (`updateMany` guard — racing verifies can't both win), 5 failed guesses self-destruct the code (brute-force window = 5 of 1,000,000 per 10 min), resend invalidates previous codes, per-IP issuance throttle (loopback exempt — the toolchain lesson), devCode never in production. Battery pins all of it; battery 293/293. |
| 5 | Safe production DB + migrations | **DONE — persistence hole closed (Tasks 60/61)** | Task 47 (`0c02959`): versioned migrations baselined, reproducibility proven, CI builds via `migrate deploy`, `db:push` demoted to safe, explicit `db:push:force` escape hatch only. **The Oct-20 wipe (×2):** schema-safe migrations did NOT mean data survived — the preview serves THIS workspace and the gitignored `db/custom.db` died with every workspace reprovision (the second one at 20:28 restored a STALE pre-fix clone, bypassing the Task-60 boot-restore). Fix, now two complementary layers: Task 60 — git-tracked secrets-scrubbed `db/sync/rah-latest.db` (hourly watchdog sync + push), restore-on-boot (dev.sh supervisor + ensure-server), FC packaging pulls the live container DB before packing (`/api/admin/db` + `/api/admin/stats`, timing-safe admin token, build ABORTS on pull failure), deploy pre-pull + post-verify stats-never-drop. Task 61 — timestamped content-aware history snapshots in tracked `backups/` (keeps 10, ~6 KB gzip), `db-migrate-safe.sh` (deploy + P3005 baseline — the bare `db push` restore used to leave NO migration history), daily watchdog history push, `/api/version` `data.createdAt` provenance tripwire, watchdog self-start. Restore drills PASS (both layers); wipe #2 forensic record in ROADMAP-AUDIT.md. PostgreSQL migration itself = mega-update (below). |
| 6 | Protect AI/speech endpoints from abuse | **DONE** | Task 50 (`d1722f7`): shared sliding-window limiter wired into ALL 14 AI-capable POST routes — 40/min signed-in per user, 15/min anonymous per client IP, 429 + Retry-After at the TOP of each POST (zero model tokens on refusal), loopback exempt for the local toolchain. Battery 307 pins + HTTP-level curl verification. |
| 7 | Model-provider failure recovery | **DONE** | Task 57: every surface that can serve non-AI content now labels it at the moment it happens - Director's briefing degrades to the ENGINE's real plan with an amber "AI offline: engine-built plan" chip (was: unhandled 500 into a misleading empty state); Talk's scene partner swaps in an in-scene placeholder + banner instead of a silent "..."; exam build/grading and materials extraction were already labeled (Tasks 38-54). Pure helpers in `src/lib/degraded.ts`, 10 battery pins (352→362). |
| 8 | Agent tool permissions + injection boundaries | **DONE** | Task 51 (`161d7cb`): explicit tier matrix (read/write/exec/network/state) covering every tool, unknown tools default to the most dangerous tier; per-run budgets enforced in loop CODE (state 2, exec 2, network 4 — refused calls never execute); both web tools wrap output in the UNTRUSTED WEB CONTENT frame; every tool result tier-tagged back to the model. Live coach drive 32/32 inside budgets. |
| 9 | Data deletion / privacy / backups | **DONE → RE-BROKEN → RE-CLOSED (Task 57)** | Deletion: Task 49 (`3b2049f`). **2026-10-21 regression:** a workspace-rebuilding update erased the untracked `db/custom.db`; boot's `db:push` silently recreated it EMPTY; the schema canary passed (it checks shape, not data); the learner lost all history and the "First Words" trophy re-fired. **Task 57 closes the class:** `scripts/db-guard.sh` — boot-time restore-if-fresh from the newest integrity-verified backup, rotating snapshots (keep 14) in `db/backups/` AND `upload/rah-backups/` (the OSS mount proven to survive workspace replacement), taken BEFORE `db:push` at boot and once per day from the supervisor loop; pre-boot snapshot also shields data from schema sync itself. Guard battery 27/27 (the incident replayed and pinned). Real fix for the SQLite era = Postgres + managed backups (mega-update). |
| 10 | Tests isolated from learner state | **DONE** | Task 52 (`f52e593`): `bash scripts/test-isolated-battery.sh` — the full battery runs against a THROWAWAY db (migrate-deploy-built) and its own dev-server instance (env-switchable distDir bypasses the Turbopack .next lock); the real db is never opened, not even by a restore. Verified 311/311 on the throwaway stack. |
| 11 | Learner data survives updates (**P0-11, the 2026-10-20 incident**) | **DONE** | Learner report: "First Words" achievement re-fired after an update. Forensics: the whole DB was recreated at 20:31 (Learner.createdAt, re-registration at 20:39, all history tables at 0) — root cause: `db/custom.db` gitignored, and only git-tracked files survive environment rebuilds. Fixed with the data-survival layer: content-aware `VACUUM INTO` snapshots in tracked `backups/` (kept 10, ~6 KB each), restore-if-missing + P3005-baseline `db-migrate-safe.sh` on every boot (never reset, never destructive push), snapshot+commit on every deploy, daily watchdog snapshot+push, and a `/api/version` `data.createdAt` tripwire. Disaster drill passed: wipe → restore → migrate → byte-identical data, achievement does NOT re-fire. Full record: ROADMAP-AUDIT.md. |

## 2. Ten critical features to add

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Bring-your-own-materials learning | **DONE (v1)** | Task 54 (`33a38ec`): paste text on the Reading tab → one AI extraction call → DETERMINISTIC source validation (answer must appear in its verbatim source sentence; zero valid = honest 502, never fabricated cards) → MaterialCard rows in the SAME FSRS queue (badge truth exact, no-orphan deletion). MaterialsPanel UI with per-card quoted source sentences. Battery 327/327; live extraction 8/8 source-validated; browser E2E 5/5. PDF/EPUB upload = v2. |
| 2 | Complete CEFR curriculum graph | **DONE** | Task 58: 18-node prerequisite graph B2 → B2+ → C1 (interference core → integration → precision), proven-only mastery gates (Wilson ≥ 0.7 over 8+ attempts per tag, skill bands over 5+ samples), frontier = closest open gate, locked nodes name their blockers. `GET /api/curriculum` + Progress "Curriculum map" card + coach "unlock" action. Battery 362→380; browser E2E 10/10. |
| 3 | Authentic exam tracks (IELTS/TOEFL/C1A) | **PARTIAL** | Exam generation with answerability + weakness targeting shipped; generic formats only. IELTS/TOEFL task types, timing, rubrics = pending. |
| 4 | Full Anki/custom-deck import | **DONE** | Round-trip complete: export as Anki-dialect TSV (Task 42); import CSV/TSV paste (Task 55); import real `.apkg` packages (Task 59) — zero-dep ZIP+SQLite reader (runtime-adaptive: node:sqlite on dev, bun:sqlite under the prod start), cloze notes → blanked cards, HTML/media refs handled honestly (counted, not dropped), Anki's own schedule stays behind so FSRS builds real intervals, new compressed format refused with the exact Anki re-export instruction. Battery 380→391; browser E2E 5/5. |
| 5 | Acoustic pronunciation assessment | **PARTIAL (honest)** | Sound Lab (Task 43) does deterministic phoneme-contrast feedback over the ASR diff — measured evidence, inferred label, honest epistemics. True acoustic assessment (Azure Speech) = pending, API decision below. |
| 6 | Real offline sync | **PENDING** | Roadmap #20. |
| 7 | Goal-based weekly planner | **PENDING** | FSRS forecast chips + daily budget explain exist (Task 44); full re-planning scheduler = pending. |
| 8 | Evidence-backed English reference | **PARTIAL** | Cards carry definitions/examples/audio; provenance of examples not yet surfaced. |
| 9 | Writing-revision workspace | **PARTIAL** | Writing placement + grammar-check + writing diagnosis exist; drafts/revisions/rubric history = pending. |
| 10 | Content quality console | **PARTIAL** | ContentFlag lifecycle shipped + coach can triage/resolve in conversation (Task 42); regression tests per flag = pending. |

## 3. Ten existing features that need polish

| # | Feature | Status | Latest evidence |
|---|---------|--------|-----------------|
| 1 | Review queue + FSRS | **DONE** | Task 44: one source of truth for counts, 2:1:1 skill-mixed introductions, forecast chips + per-card scheduler lines + live intervals, Keep-practicing ahead mode with auto-continue. Task 56 (`ab9514a`): configurable daily limit (3..30 stepper), suspend/unsuspend with preserved schedules, undo already shipped. |
| 2 | Talk conversation mode | **DONE (v1)** | Task 41: deterministic scenarios, in-scene coach, always-present typed fallback, engine-computed session report. Mobile-browser quirks still untested. |
| 3 | Sound Lab | **DONE (inference tier)** | Task 43. Acoustic tier = feature #5 above. |
| 4 | AI coach transparency | **PARTIAL** | Stop control, execution trace + copy, content flags, triage loop, read_state mandate enforced in code (Tasks 40–42). Remaining: "why this recommendation" evidence surfacing. |
| 5 | Exam generation/grading | **PARTIAL** | Answerability + weakness targeting + dedicated live retest (Task 38). Item-bank validation + distractor quality pass pending. |
| 6 | Placement/CEFR honesty | **PARTIAL** | Bands show proven-only evidence (Task 39). Sample counts + uncertainty display pending. |
| 7 | Mistake memory/mastery | **PARTIAL** | Persistent mistake families feed weakness bias; retirement rate in outcomes ledger. Learner-side correction of a wrong weakness tag pending. |
| 8 | XP/gems/quests/bot | **PARTIAL** | Practice bot self-labeled (Task 44), shop tooltips. Anti-farming pass pending. |
| 9 | Progress reports | **PARTIAL** | Effectiveness + improvement ledgers, zero-AI numbers (Tasks 39/41). Proxy-metric caveats on spoken fluency pending. |
| 10 | Onboarding/naming | **PARTIAL** | PRACTICE BOT badge, shop tooltips, forecast copy (Task 44). Full plain-language naming audit (e.g. beyond "Behnam Blackout") pending. |

## 4. Three apps to reverse-engineer next

| App | Status | Output |
|-----|--------|--------|
| Duolingo | **DONE** | `DUOLINGO-RE.md`; word-bank tiles, streak/budget doctrine, practice-bot labeling shipped. |
| Anki | **DONE** | Review mechanics studied (forecast, ahead mode, budget - Tasks 44/56); export interop (Task 42); import interop complete (Tasks 55/59: CSV/TSV + real .apkg packages). Custom per-deck scheduling settings = intentionally not (Rah's FSRS owns scheduling - documented in the import UI). |
| ELSA Speak | **PARTIAL** | Sound Lab = our honest version of sound-level feedback; acoustic assessment pending. |
| LingQ | **PENDING** | Feeds feature #1 (BYO materials). |

## 5. Three critical data stores

| Store | Status | Notes |
|-------|--------|-------|
| PostgreSQL (primary) | **PENDING (by design)** | SQLite + versioned migrations now; the Postgres move is coupled with per-user scoping (mega-update, stage 01→03 bridge). |
| Redis/Valkey (ops state) | **PENDING (by design)** | In-memory throttles are single-node-safe and documented as such (Task 46). Needed only at multi-instance scale. |
| R2/S3 (objects) | **PENDING (by design)** | Workspace files are sandboxed local FS today; object storage comes with the deployment push. |

## 6. Three critical APIs

| API | Status | Notes |
|-----|--------|-------|
| LLM API w/ structured outputs | **DONE** | `aiJson` ladder + deterministic post-validation before any DB write; backoff/retry (Task 40+). |
| Azure AI Speech (pronunciation) | **PENDING** | Decision gate for Sound Lab v2 (acoustic tier). |
| Resend/transactional email | **PARTIAL** | SMTP path exists (`mailer.ts`, any provider incl. Resend); delivery-failure reporting + idempotency keys pending. |

## 7. The audit's implementation order

| Stage | Status |
|-------|--------|
| 01 Stabilize and isolate | **5/5 P0s closed + data survival closed + REG-2 privacy closed** (Tasks 45–48, 60/61, 57-bis, 62): CI green (and TRIGGERING — the branch selector was corrupted until 57-bis), isolation enforced (deployment lock), auth hardened, migrations versioned, learner data survives updates (multi-layer restore + drills), and learner data NEVER reaches the public repo (snapshots moved to the private vault repo). |
| 02 Make the learning system trustworthy | **5/5 CLOSED** (Tasks 49–52 + 57): real account deletion, AI-endpoint rate limits, tool-permission matrix + injection boundaries, fully isolated battery stack, and honest degraded states on every AI surface (Task 57). |
| 03 Add the differentiators | **IN PROGRESS** — BYO materials SHIPPED (Task 54); CEFR curriculum graph SHIPPED (Task 58); .apkg import SHIPPED (Task 59); acoustic pronunciation + authentic exam tracks pending. |
| 04 Dependable daily product | PENDING — Anki import, offline sync, reminders, longitudinal evidence. |

---

## Velocity log (this audit wave)

| Task | Commit | What closed |
|------|--------|-------------|
| 45 | `4d4f582` | P0-2 CI green (root cause + false-positive check) |
| 46 | `240100a` | P0-3 + P0-4 auth hardening (battery 285→293) |
| 47 | `0c02959` | P0-5 versioned migrations, safe push defaults |
| 48 | `0e9100e` | P0-1 deployment lock (audit-sanctioned single-user) |
| 49 | `3b2049f` | P1-9 real account deletion (+ UI, isolation pin; battery 293→301) |
| 50 | `d1722f7` | P1-6 AI abuse limits on all 14 AI routes (battery 301→307) |
| 51 | `161d7cb` | P1-8 tool tier matrix + per-run budgets + injection frame (battery 307→311) |
| 52 | `f52e593` | P1-10 fully isolated battery stack (throwaway db + own server) |
| 57 | `cd35f15` | P1-7 honest degraded states everywhere (battery 352→362) + isolated-battery self-sufficiency fix |
| 58 | `3e49329` | feature #2 CEFR curriculum graph (battery 362→380; browser E2E 10/10) |
| 59 | `6b9fda4` | feature #4 COMPLETE: real .apkg import (battery 380→391; browser E2E 5/5) |
| 60 | `5156b4b` | P0: learner data survives updates — root-caused the Oct-20 wipe; scrubbed snapshot + restore-on-boot + hourly sync + deploy pre-pull/post-verify + pull-before-package guard. Route tests 16/16; restore drill PASS; battery 391/391 |
| 61 | this wave | **Second wipe (20:28, stale reprovision) + merge of both survival layers** — timestamped history snapshots (content-aware, keeps 10), `db-migrate-safe.sh` (P3005 baseline), daily history push, `/api/version` `data.createdAt` tripwire, watchdog self-start, session-start sync convention; pre-wipe history confirmed unrecoverable |
| 57-bis | `9b9c360` | 2026-10-21 third wipe forensics + fix: db-guard (boot restore-if-fresh from verified backups, dual-location rotating snapshots), achievement P2002 race hardening, CI branch-selector corruption fixed (pushes to main had never triggered CI), battery deployment-lock env scoped to the throwaway stack |
| 62 | this wave | **REG-2 (evaluator 2026-10-22): learner data out of the PUBLIC repo** — db-sync retargeted to the private vault repo (`rah-web/` folder), deploy.sh + watchdog.sh retargeted, `db/sync` + `backups/` + `db/battery-isolated.db*` scrubbed from ALL public git history and force-pushed; the published snapshot's 14 rows (email + first progress) restored into the live DB so the learner keeps streak=1/xp=10/first_words |
| 62-bis | this wave | **filter-repo working-tree wipe found + fixed** — the history scrub had silently reverted the Task-62 script rewrites (commit message claimed them; the diff didn't carry them). `scripts/vault-sync.sh` built as the single offsite choke point (remote-URL assertion, negative-tested), db-sync/deploy/watchdog re-retargeted, db-restore gained the vault source, db-guard restore order now db/sync → OSS mount → local, committed `.gitignore` conflict markers removed. Evidence: vault pushes 50cbdb9+f30a7fa (remote==local), origin/main unmoved at d858ddb, guard battery 27/27, isolated battery 391/391, restore-priority micro-test PASS |

**Gate status:** battery **391/391** on the throwaway stack · guard battery **27/27** · admin route 16/16 · restore drills PASS (Task 60/61 + merged) · portable drive 15/15 · deployment-lock 6/6 · auth E2E 8/8 · deletion E2E 3/3 · live coach drive 32/32 · `tsc --noEmit` + eslint clean.

**Honest ledger (data):** pre-Oct-20 history is gone forever (three wipes: 18:16, 20:28, and the Oct-21 workspace rebuild). What exists today = the Oct-20 21:05 snapshot's 14 rows (restored to the live DB in Task 62) + everything the learner does from now on — and the learner IS back (live DB at Task 62-bis: xp=220, streak=2, first_words, 5 reviews, 4 chats). Protection now provable end-to-end: hourly+daily snapshots pushed to the PRIVATE vault (commits verified remote==local), boot restore-if-fresh with db/sync as freshest source, deploy pre-pull/post-verify, and the `/api/version` `data.createdAt` tripwire. **The evaluator's 2026-10-22 P0 stays closed: the public repo carries zero learner data; the only offsite copies live in the private vault repo (`rah-web/` folder).** The published email should still be treated as exposed (public git history cached by third parties) — re-registration with the same address works, or a fresh address can be claimed.