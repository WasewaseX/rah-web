# ROADMAP STATUS — the external audit, item by item

**Last updated:** 2026-10-20 · **Source:** the October 2026 external engineering + product audit ("overall: stabilize before expanding").
**How to read:** each item carries DONE / PARTIAL / PENDING, with the evidence (task, commit, gate). Battery = `scripts/test-api-battery.ts` (362 checks, run via `bash scripts/test-isolated-battery.sh` on the throwaway stack); portable drive = `scripts/test-portable.ts`; all gates green at time of writing.

---

## 1. Critical things to fix first

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Learner data isolation | **PARTIAL → hole closed** | Task 48 (`0e9100e`): deployment lock — first account claims the deployment, further registrations refused unless `RAH_OPEN_REGISTRATION=1` (audit's sanctioned single-user alternative). Full per-user scoping (userId on every learning model, scoped queries, two-user route tests) = tracked mega-update below. Lock tested 6/6 on a throwaway migrated DB. |
| 2 | Make GitHub CI green | **DONE** | Task 45 (`4d4f582`): root-caused the months-long Typecheck failure — `playwright` was an undeclared parent-dir dep; local tsc resolved it via `/home/z/node_modules` while CI correctly failed TS2307. Fixed with an optional-dep dynamic import; verified under true CI simulation. Audit's "branches: ain]" claim was a false positive (byte-checked). Portable drive also re-greened (15/15) with a real login. |
| 3 | Remove auth token from localStorage | **DONE** | Task 46 (`240100a`): normal login now returns NO browser-readable credential (httpOnly cookie only); embedded callers get a Partitioned SameSite=None cookie (CSRF-guarded by the custom `x-rah-embed` header) with the raw token as last resort stored in **sessionStorage** (dies with the tab); legacy localStorage tokens scrubbed on load. E2E 8/8 in a real browser: top-level = zero tokens in any JS storage; iframe = sessionStorage-only fallback works. |
| 4 | Harden email-code auth | **DONE** | Task 46 (`240100a`): codes stored as sha256 hashes (plaintext memory-only), atomic single-use consume (`updateMany` guard — racing verifies can't both win), 5 failed guesses self-destruct the code (brute-force window = 5 of 1,000,000 per 10 min), resend invalidates previous codes, per-IP issuance throttle (loopback exempt — the toolchain lesson), devCode never in production. Battery pins all of it; battery 293/293. |
| 5 | Safe production DB + migrations | **DONE (for SQLite era)** | Task 47 (`0c02959`): versioned migrations baselined (`prisma/migrations/0001_init`), reproducibility proven (fresh-DB deploy → schema diff = zero difference), CI now builds its DB via `migrate deploy`, `db:push` demoted to safe (asks on data loss), explicit `db:push:force` escape hatch only. PostgreSQL migration itself = mega-update (below). |
| 6 | Protect AI/speech endpoints from abuse | **DONE** | Task 50 (`d1722f7`): shared sliding-window limiter wired into ALL 14 AI-capable POST routes — 40/min signed-in per user, 15/min anonymous per client IP, 429 + Retry-After at the TOP of each POST (zero model tokens on refusal), loopback exempt for the local toolchain. Battery 307 pins + HTTP-level curl verification. |
| 7 | Model-provider failure recovery | **DONE** | Task 57: every surface that can serve non-AI content now labels it at the moment it happens - Director's briefing degrades to the ENGINE's real plan with an amber "AI offline: engine-built plan" chip (was: unhandled 500 into a misleading empty state); Talk's scene partner swaps in an in-scene placeholder + banner instead of a silent "..."; exam build/grading and materials extraction were already labeled (Tasks 38-54). Pure helpers in `src/lib/degraded.ts`, 10 battery pins (352→362). |
| 8 | Agent tool permissions + injection boundaries | **DONE** | Task 51 (`161d7cb`): explicit tier matrix (read/write/exec/network/state) covering every tool, unknown tools default to the most dangerous tier; per-run budgets enforced in loop CODE (state 2, exec 2, network 4 — refused calls never execute); both web tools wrap output in the UNTRUSTED WEB CONTENT frame; every tool result tier-tagged back to the model. Live coach drive 32/32 inside budgets. |
| 9 | Data deletion / privacy / backups | **DONE** | Task 49 (`3b2049f`): DELETE /api/account (auth-gated) — user row + cascade sessions + login codes; LAST-user-out (single-user deployment = account == learner) wipes ALL learner state (20 tables + Learner row + coach workspace files) and un-claims the deployment; other-accounts-remaining keeps shared state and says so in the response. Sidebar two-step Delete UI. Battery 301/301 incl. the isolation pin; E2E 3/3 in a real browser. |
| 10 | Tests isolated from learner state | **DONE** | Task 52 (`f52e593`): `bash scripts/test-isolated-battery.sh` — the full battery runs against a THROWAWAY db (migrate-deploy-built) and its own dev-server instance (env-switchable distDir bypasses the Turbopack .next lock); the real db is never opened, not even by a restore. Verified 311/311 on the throwaway stack. |

## 2. Ten critical features to add

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Bring-your-own-materials learning | **DONE (v1)** | Task 54 (`33a38ec`): paste text on the Reading tab → one AI extraction call → DETERMINISTIC source validation (answer must appear in its verbatim source sentence; zero valid = honest 502, never fabricated cards) → MaterialCard rows in the SAME FSRS queue (badge truth exact, no-orphan deletion). MaterialsPanel UI with per-card quoted source sentences. Battery 327/327; live extraction 8/8 source-validated; browser E2E 5/5. PDF/EPUB upload = v2. |
| 2 | Complete CEFR curriculum graph | **DONE** | Task 58: 18-node prerequisite graph B2 → B2+ → C1 (interference core → integration → precision), proven-only mastery gates (Wilson ≥ 0.7 over 8+ attempts per tag, skill bands over 5+ samples), frontier = closest open gate, locked nodes name their blockers. `GET /api/curriculum` + Progress "Curriculum map" card + coach "unlock" action. Battery 362→380; browser E2E 10/10. |
| 3 | Authentic exam tracks (IELTS/TOEFL/C1A) | **PARTIAL** | Exam generation with answerability + weakness targeting shipped; generic formats only. IELTS/TOEFL task types, timing, rubrics = pending. |
| 4 | Full Anki/custom-deck import | **PARTIAL → import v1 SHIPPED** | Export: Anki-dialect TSV (Task 42). Import: Task 55 (`038259d`) — CSV/TSV paste (tab/comma auto-detect, `#` headers skipped, quoted cells, dedupe, 300-row cap), smart row mapping (pre-blanked passthrough, auto-blanking, front-back), rides the Task-54 FSRS queue. `.apkg` binary = v2. |
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
| Anki | **PARTIAL** | Review mechanics studied (forecast, ahead mode, budget); export interop shipped; import + custom scheduling settings pending. |
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
| 01 Stabilize and isolate | **5/5 P0s closed** (Tasks 45–48): CI green, isolation enforced (deployment lock), auth hardened (cookie-only + code hardening), migrations versioned. |
| 02 Make the learning system trustworthy | **5/5 CLOSED** (Tasks 49–52 + 57): real account deletion, AI-endpoint rate limits, tool-permission matrix + injection boundaries, fully isolated battery stack, and honest degraded states on every AI surface (Task 57). |
| 03 Add the differentiators | **IN PROGRESS** — BYO materials SHIPPED (Task 54); CEFR curriculum graph SHIPPED (Task 58); acoustic pronunciation + authentic exam tracks pending. |
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
| 57 | this commit | P1-7 honest degraded states everywhere (battery 352→362) + isolated-battery self-sufficiency fix (RAH_OPEN_REGISTRATION now exported by the script, not .env) |
| 58 | this commit | feature #2 CEFR curriculum graph (battery 362→380; browser E2E 10/10) |

**Gate status:** battery 380/380 (isolated throwaway stack) · portable drive 15/15 · deployment-lock 6/6 · auth E2E 8/8 · deletion E2E 3/3 · live coach drive 32/32 · curriculum E2E 10/10 · `tsc --noEmit` clean (CI-honest, parent-dir-dep aware).
