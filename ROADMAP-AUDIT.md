# ROADMAP AUDIT — checklist, incidents, and open items

**Created:** 2026-10-20 (Task 60 wave) · **Updated:** 2026-10-22 (REG-1/REG-2 waves + **Task 67 reconciliation**: this file is the canonical ledger; `ROADMAP-STATUS.md` now agrees with it on offline, goal planner, pronunciation, exam tracks, email and Azure — disagreements found and removed, see §3 bookkeeping) · **Companion to:** `ROADMAP-STATUS.md` (per-item evidence) · **Audience:** the builder + any future evaluator wave.

Purpose: one place that tracks (a) incident post-mortems with acceptance tests, (b) the standing audit checklist, (c) what an external evaluator praised vs. what actually broke. Update it every wave; do not let "DONE" claims outrun the drills that prove them.

---

## 0. Incident log (chronological)

## 0. Incident log

### 2026-10-20 — "First Words achievement again" (P0, learner data wiped by an update)

**Symptom.** After the Tasks 57–59 update wave, the learner was reset: the "First Words" achievement re-fired, XP/streak/history back to near-zero. Third occurrence pattern ("again").

**Root cause (proven, not guessed).**
- The preview URL is a **tunnel to THIS workspace's dev server** — proven by comparing `/api/version` fingerprints (same git SHA, same `startedAt`, ~150 ms apart). There is no second database elsewhere serving the learner.
- The live learner DB is `/home/z/my-project/db/custom.db` — **gitignored** ("runtime data - not for the public repo").
- Update waves **reprovision the workspace from git** (this workspace was proven to be a Task-56-era clone while remote main already had Tasks 57–59). A reprovision is a fresh clone: the gitignored DB dies with it.
- `.zscripts/dev.sh` (platform boot supervisor) then runs `db:push` against the missing DB → empty learner → "First Words" re-fires. The prior "2026-10-10 incident" comment in dev.sh (platform volume restore rolled the DB back) shows this class of failure had already struck once.

**Why the evaluator's "Safe database migrations: Done" missed it.** Task 47 made *schema* migrations versioned and reproducible. Schema safety ≠ data persistence across environment rebuilds. Lesson: an audit item is only DONE when a drill reproduces the failure mode and proves the fix.

**Fix (four independent layers, all in this wave):**
1. **Git-tracked survival snapshot** — `scripts/db-sync.sh` writes `db/sync/rah-latest.db` (consistent `sqlite3` online backup) and **scrubs Session + LoginCode** rows; committed and pushed so the repo carries learner progress across reprovisions. Triggered hourly by the watchdog, at every deploy, and manually.
2. **Restore-on-boot** — `.zscripts/dev.sh` (at boot AND on every supervisor restart) and `scripts/ensure-server.sh` restore `db/custom.db` from the snapshot when the live DB is missing, before any `db:push` can create an empty learner.
3. **FC/deploy path guard** — `/api/admin/db` (consistent `VACUUM INTO` snapshot download) + `/api/admin/stats` (state fingerprint), both guarded by a timing-safe-compared admin token (env `RAH_ADMIN_TOKEN` or `db/admin-token`, packaged next to the DB). `.zscripts/build.sh` now **pulls the live DB before packaging** (falls back only on 404/unreachable; ABORTS the build on auth failure or invalid download so stale data can never silently overwrite real data). `scripts/deploy.sh` waits for preview freshness, then diffs pre/post stats (xp/streak/reviews/users must never drop) and fails loudly on regression.
4. **Local backups** — every pre-pull swap archives the previous DB to `db/backups/pre-pull-*.db` (newest 20 kept).

**Acceptance evidence.**
- Route tests 16/16 (`bun scripts/test-admin-db-route.ts`): 404-locked-when-unconfigured, 401 on wrong/missing bearer, snapshot = standalone valid SQLite with seeded state, scrubbing, env-token path, no temp-file leakage.
- Packaging tests (`bash tests/database-runtime-build.sh`): DB + sidecars + admin-token packaged; `backups/`, `sync/`, stats json, snapshot tmps excluded; empty-DB seeding now prefers the git snapshot when the live DB is gone.
- **Restore drill PASS:** `db/custom.db` deleted (simulated reprovision) → `ensure-server` boot → learner state intact (xp 10, streak 1, 2 reviews, 1 achievement, 1 user).
- Full battery 391/391 on the throwaway stack; `tsc --noEmit` + `eslint` clean.

**Residual risks (honest).**
- Data written **since the last snapshot** is still exposed to a surprise reprovision (window: ≤1 h via watchdog, ≤ one deploy via deploy.sh). The evaluator's PostgreSQL recommendation remains the structural fix for multi-user; for the single-learner era this window is accepted and documented.
- The old supervisor instance ran pre-patch code until restarted; the new restore logic is active from this boot onward (drill ran against the live supervisor path).
- `db/custom.db.stats.json` / `post-pull-stats.json` are workspace artifacts — gitignored and excluded from packages.

### 2026-10-20 20:28 UTC — SECOND wipe the same day: the stale-reprovision lesson (Task 61)

**What happened.** Hours after the Task-60 fix landed on remote main, another reprovision hit. Forensics from the live DB: `Learner.createdAt = 20:31:51`, user re-registered 20:39:28, `first_words` re-earned 20:39:48, `.env` + `prisma/migrations/**` all stamped 20:28:42 — and the working tree was back at the **Task-56-era commit (`79ac327`)**, i.e. the reprovision restored a STALE ref that pre-dated the Task-60 boot-restore. The fix was on GitHub, but the booting tree didn't contain it. The learner saw the achievement fire for the third time.

**Recovery limits (checked, honestly negative).** The remote Task-60 snapshots (`db/sync/rah-latest.db` at 18:52 / 18:57 / 19:56) all POST-date wipe #1 (≈18:16): the 19:56 snapshot itself has `Learner.createdAt = 18:16:57` — i.e. the first wipe had already destroyed the original history before any snapshot existed. The learner re-registered twice (18:27 and 20:39) and re-did their first reviews each time. **Pre-wipe history is confirmed unrecoverable**; the 19:56 snapshot is not richer than the live DB, so no restore was performed (it would only have killed the learner's fresh session).

**Task-61 additions (complementary layer, merged with Task 60 in this wave):**
1. **Timestamped history snapshots** — `scripts/db-snapshot-core.ts` + `db-snapshot.sh`: hygiene (expired auth rows pruned, ACTIVE sessions kept — the learner stays logged in across updates) then SQLite `VACUUM INTO` (consistent while the server runs), gzip (~6 KB), content-aware sha256 skip (zero churn), keeps 10, in git-tracked `backups/`. Triggered per deploy and daily by the watchdog (bounds surprise-reprovision loss to ≤1 day even with no deploys).
2. **Migration-safe restore** — `scripts/db-migrate-safe.sh`: `migrate deploy`, and on **P3005** (schema without history — exactly what the previous bare-`db push` restore produced) baselines every existing migration as applied, then deploys. NEVER `migrate reset`, NEVER `db push --accept-data-loss`.
3. **Unified restore-if-missing** — `scripts/db-restore.sh`: prefers `db/sync/rah-latest.db` (hourly cadence), falls back to newest `backups/` history; runs before the server boots in `ensure-server.sh`.
4. **Visible tripwire** — `GET /api/version` now returns `data: { createdAt, xp, streak, reviews, latestSnapshot }` (failure-isolated). Doctrine: after every update, `data.createdAt` must be UNCHANGED; if it equals the deploy time, data died and we know instantly.
5. **Watchdog self-start** — `scripts/ensure-watchdog.sh` called from `ensure-server.sh`, so the watchdog (and both snapshot cadences) survive reprovisions that boot a stale-but-alive tree.
6. **Session-start sync doctrine** — first action of every working session: `git fetch` + fast-forward pull BEFORE starting servers, so a stale reprovision is upgraded to the newest code (with its restore logic) and newest snapshots before anything boots.

**Task-61 acceptance evidence.** Disaster drill: snapshot → `db/custom.db` deleted → `db-restore.sh` + `db-migrate-safe.sh` (P3005 detected → 0001/0002 baselined → deploy OK) → post-restore DB byte-identical (streak 1, xp 10, 2 reviews; `first_words.at` unchanged → no re-fire). `/api/version` serving `data` block on the live server. Watchdog relaunched and independently produced the first history push (`b02be56`) within minutes of boot. `tsc --noEmit` clean; eslint clean on touched files.

**Merged-ops note.** The two layers now share one boot path (`ensure-server.sh`: restore → migrate-safe → health → snapshot + db-sync + watchdog) and one deploy path (`deploy.sh`: db-pull → history snapshot → push → freshness wait → stats-never-drop verify → mirror refresh → db-sync). Watchdog: hourly `db-sync` (freshness) + daily `backups/` history (depth).

---

---

### REG-1 (2026-10-21, CRITICAL, CLOSED): learner DB destroyed by update — "First Words" achievement re-fired

**Symptom (learner report):** after the update, the "First Words" achievement fired AGAIN. Learner's own words: *"wtf happened to the supposedly safe database if it wont survive with updates."*

**Root-cause chain (verified in code and data, not inferred):**
1. A platform update rebuilt the workspace from git (~13:58). Everything untracked died; only git-tracked files and the `upload/` OSS mount survived (Oct 8–10 files still present on the mount prove the mount's durability).
2. `db/custom.db` is deliberately untracked (privacy: learner chat logs must never be published) — so it died with the workspace.
3. The boot supervisor (`.zscripts/dev.sh`) ran `bun run db:push`, which silently created a brand-new empty database (Learner row born 14:01:37, `xp=0 streak=0`, every table zero rows — inspected directly).
4. The boot canary (`MistakeFamily.count()` reachable) passed: it validates schema SHAPE, not DATA presence.
5. `evaluateAchievements()` is idempotent (only inserts missing rows) — so the re-award proves the `Achievement` table itself was empty. The trophy was a symptom; the disease was total data loss (ReviewLog, CardState, achievements, FSRS schedules, gems, streak).

**Collateral casualties of the same update:** the gitignored `.env` lost `RAH_OPEN_REGISTRATION=1` (toolchain unlock — battery multi-user fixtures then hit the Task-48 deployment lock, 7 battery fails), and `.github/workflows/ci.yml`'s branch selector was confirmed corrupted (`branches: ain]` — the audit was right, the earlier "false positive" byte-check was wrong), which means **pushes to main had not been triggering CI at all**.

**Fixes shipped (Task 57):**
- `scripts/db-guard.sh` — the data guard, runs FIRST at boot (needs only bash+python3, before even `bun install`):
  - live DB missing or shows no real usage → restore the newest **integrity-verified** backup (SQLite open + Learner readable), loudly logged; corrupt newest backups are skipped with a warning, never restored;
  - live DB holds real usage → rotating snapshot (keep 14) to **two** locations BEFORE `db:push` can touch it: `db/backups/` (fast, local) and `upload/rah-backups/` (the OSS mount that survives workspace replacement);
  - restore never clobbers a used DB (usage-signal classifier: xp/streak/gems/sp or any history rows ⇒ not fresh);
  - `flock` single-flight; torn-copy protection via probe-then-retry.
- `.zscripts/dev.sh` wired: guard at boot + a **daily** snapshot tick inside the supervise loop (a long-lived container must not depend on reboots for backups).
- `evaluateAchievements()` hardening: concurrent graders racing the `createMany` can no longer 500 a grade route (P2002 swallowed as "already awarded").
- `ci.yml` branch selector fixed (list form — lesson recorded: bracketed values get silently mangled in this workspace).
- `RAH_OPEN_REGISTRATION=1` scoped to the throwaway battery stack only (process env), so the production deployment's lock stays ACTIVE by default — strictly safer than the old shared-`.env` arrangement.
- `db/battery-isolated.db` untracked (test artifact was committed; also the reason it survived the update while the real DB didn't).

**Gates:** guard battery `scripts/test-db-guard.sh` **27/27** (includes the incident replayed: snapshot → DB wiped → boot → restored with data intact); full isolated battery **352/352**; tsc + eslint clean.

**Honest limits:** the lost history itself is unrecoverable from the sandbox (no backup existed before this fix — that is the lesson). If the learner kept a portable export bundle (`.rah` export from Settings), re-import restores everything; the bundle format is hash-verified and idempotent. The durable fix remains the planned PostgreSQL + managed-backup move (mega-update, stage 01→03 bridge).

---

### REG-2 (2026-10-22, CRITICAL PRIVACY, CLOSED): learner data published to the PUBLIC repo — the Task 60/61 survival fix created a leak

**Symptom (evaluator's 2026-10-22 re-review, rating 7.6/10 overall / 8.6/10 engineering):** the public repo (WasewaseX/rah-web) carries `db/sync/rah-latest.db` via `scripts/db-sync.sh`, plus `backups/rah-*.sqlite.gz` history snapshots. The scrub removes Session/LoginCode but keeps the User row (learner EMAIL), learner profile, chat messages, writing submissions, speaking transcripts, and learning history — "sufficient to make this a critical risk" even though the inspected snapshot was small.

**Forensic sizing (blobs inspected, not assumed):** every published snapshot version (18:57 through 21:05 UTC) is byte-equivalent in content: 14 rows total — 1 User (email), 1 Learner (xp=10, streak=1), 2 ReviewLog, 2 CardState, 1 Achievement, 1 DailyStat, bootstrap rows. ChatMsg/WritingSub/SpeakSession all ZERO (the wipe had already taken the rich history before the first snapshot). So the leak is REAL but SMALL: one email address + first-session progress, across ~30 commits of public git history.

**Fixes shipped (Task 62):**
1. `scripts/db-sync.sh` retargeted: local snapshot stays at `db/sync/rah-latest.db` (gitignored, freshest restore source for db-guard); the PUSH now goes to the PRIVATE vault repo (WasewaseX/vault), new folder `rah-web/`, layout `rah-latest.db` + `history/rah-<UTC>.db` (keep 30), README documenting the doctrine. Token never hardcoded — derived at runtime from the configured remote.
2. `scripts/deploy.sh` + `scripts/watchdog.sh` retargeted the same way (their "learner history rides every push" doctrine is REVERSED: the public repo now carries ZERO learner data).
3. PUBLIC GIT HISTORY SCRUBBED: `git filter-repo` removed `db/sync/`, `backups/`, and `db/battery-isolated.db*` from every commit; main force-pushed. (Third-party caches of the old commits can still exist — treat the email as exposed; GitHub Support can purge remaining cached views.)
4. RECOVERY BONUS: the newest public snapshot was RESTORED into the live DB (14 rows: email account, streak=1, xp=10, 2 reviews, first_words) — the learner's post-Oct-21-wipe state is back, and the deployment-lock posture is preserved (User row restored = deployment claimed).
5. db-guard gained the db-sync snapshot as a third restore source (freshest-first: db/sync → upload/rah-backups OSS mount → db/backups).

**Doctrine change:** snapshots live ONLY in the private vault (access-controlled). The public repo carries code, docs, and synthetic test data — never learner rows. Retention: 30 dated copies in the vault. Encryption of vault snapshots = open decision (needs a key-management answer; the DB holds no secrets by the redaction doctrine, the vault is private).

**Gates:** vault push verified via API (rah-web/rah-latest.db present, private repo); public repo verified via API + raw URL (snapshot paths 404, history clean); restore verified on the live DB; battery + tsc + eslint green.

**ADDENDUM (Task 62-bis, 2026-10-22) — the filter-repo working-tree wipe, found and closed.** The closure claims above were true when written, then silently broken: `git filter-repo` reset the working tree during the history scrub and **reverted the uncommitted script rewrites** (db-sync/deploy/watchdog/db-restore/db-guard). Commit d858ddb only carried `.gitignore`, `restore-from-snapshot.py`, and the worklog — its message claimed the rest. For ~2 hours the data pipeline was in the worst possible intermediate state: NOT leaking (the new `.gitignore` made `git add` refuse the snapshot paths — db-sync failed loudly instead of pushing) but ALSO not backing up offsite (the hourly watchdog job died at `git add`). Rediscovered by a claims-vs-diff audit (commit message stat vs. actual files). Fixes re-shipped:
- `scripts/vault-sync.sh` (NEW): the single choke point for offsite learner data. Asserts the resolved remote URL is `WasewaseX/vault` and aborts on any URL containing `rah-web` (the public repo) — negative-tested with a public-URL override and a junk-URL override (both abort, exit 1).
- `scripts/db-sync.sh` rewritten: local snapshot (db/sync/rah-latest.db, gitignored) + vault push; zero origin pushes; `--no-git` test contract preserved.
- `scripts/deploy.sh` step 2.5/7 and `scripts/watchdog.sh` daily block: all `git add backups`/`push origin` data paths removed; offsite = vault only.
- `scripts/db-restore.sh`: vault clone added as restore source #2 (db/sync → vault → local gz). `scripts/db-guard.sh`: db/sync snapshot is the freshest-first restore source (micro-tested: sync-source rows beat an older guard backup).
- `.gitignore`: committed merge-conflict markers (`<<<<<<< HEAD`) removed; both sides' patterns merged.

**Verification (62-bis):** end-to-end vault pushes `50cbdb9` + `f30a7fa` with remote main == local HEAD; `origin/main` unmoved at `d858ddb` (zero learner data public); `git status` carries no data paths; guard battery 27/27; isolated battery 391/391; all scripts `bash -n` clean. **Process lesson (recorded for any future history rewrite): run `git filter-repo` ONLY on a fully committed tree, then re-verify every "shipped" claim against the post-rewrite working tree before declaring closure — a commit message is not a diff.**

---

### REG-3 (2026-10-22 06:51 UTC, 4th wipe, CONTAINED-BY-DESIGN): stale reprovision from 9b9c360 — the guard held, the freshness window didn't

**What happened:** the platform rebuilt the workspace again (4th wipe), this time from a STALE ref (Task-57-era 9b9c360, not origin/main). Cost: db/sync, db/vault-work, backups/, db/backups and the vault remote config all died (gitignored or local state); the boot guard restored the learner automatically — but from the 21:47 OSS snapshot (xp=10), stale by one evening of learning (the learner had reached xp=220, 17 reviews, 6 chats by 22:57).

**What held:** db-guard booted, probed, restored, snapshotted — the Task-57 fix worked exactly as drilled. The vault held the freshest state (rah-web/history/rah-20261021T225730Z.db) because Task 62-bis pushed it there before the wipe.

**What was missing (closed this wave, Task 63):**
1. The guard's restore order predated the db-sync snapshot: it ranked the dated OSS copies (stale) over nothing, unaware a fresher fixed-name copy could exist. FIX: db-sync now stages `upload/rah-backups/rah-latest.db` (the rebuild-proof OSS mount) on EVERY sync, and db-guard's boot restore order is db/sync → OSS rah-latest.db → dated backups. A post-rebuild boot is now at most one sync interval behind, not one boot-to-boot gap.
2. Recovery from the vault: scripts/restore-from-vault.py (column-intersection restore — adapts pre-isolation-schema snapshots into the new schema, keeps live auth + daily bootstrap). The learner's xp=220 state was restored from the vault, then re-synced everywhere.
3. The stale-ref problem itself (platform reprovisions from an old cached ref) is NOT fully closable from inside the workspace — mitigation is data-side: with the OSS freshest copy + the vault, no rebuild can lose more than an hour.

**Gates:** live DB xp=220/streak=2/6 chats/17 reviews after restore + restart; vault re-clone + push verified remote==local; guard battery 27/27 incl. new ordering micro-tests.

---

## 1. Standing checklist (evaluator's October 20 + 22 updates, reconciled)
Legend: ✅ done · 🟡 partial · ❌ not started · 🔺 NEW risk found this wave.

### Critical fixes (9/10 closed + 1 hole found and closed)
- ✅ Green GitHub CI (Task 45)
- ✅ No browser-readable auth tokens (Task 46)
- ✅ Secure email verification codes (Task 46)
- 🟡→✅ Safe database — evaluator's ✅ was **half true** 🔺: schema migrations safe, data persistence broken. Closed by Tasks 60+61 + 57-bis (three wipes total; see incident log). **REG-2 amendment (2026-10-22):** the survival fix itself leaked learner data into the public repo — closed by moving ALL snapshots to the private vault repo and scrubbing public history.
- ✅ AI endpoint rate limits (Task 50)
- ✅ AI-provider failure recovery (Task 57)
- ✅ Agent permissions + prompt-injection defenses (Task 51)
- ✅ Account deletion + privacy cleanup (Task 49)
- ✅ Isolated automated tests (Task 52)
- 🟡 Learner data isolation — **content surfaces complete (Tasks 63+65)**: userId + scoped queries + two-account battery on chats, essays, transcripts, review logs, mistake memory (families/corrections/tombstones), mastery ledger, daily stats, goals and state counts. **Residual under the deployment lock:** CardState (FSRS queue) + arcade meta tables remain global keys — aggregate state, no learner prose. Full closure = the multi-user push (with PostgreSQL).

### Critical features (4 done, 6 partial — reconciled 2026-10-22, Task 67)
- ✅ Bring-your-own-materials (Task 54) · ✅ CEFR curriculum graph (Task 58) · ✅ Anki .apkg import (Task 59) · ✅ Goal-based weekly planner (Task 65: FSRS due-load forecast + observed rhythm + honest feasibility, deterministic)
- 🟡 Exam tracks (IELTS/TOEFL/C1A) — format-faithful tracks shipped (Task 66); **scores are practice estimates** until grading is validated against expert-reviewed responses and exam-specific rubrics
- 🟡 Acoustic pronunciation assessment — **word-level measured tier shipped (Task 64)**; NOT a complete phonetic/accent assessment until the Azure phoneme adapter is configured AND validated
- 🟡 Offline sync — offline shell + cached reads shipped (PWA wave: SHA-versioned SW, offline reload, honest 503s, test-pwa 12/12); offline WRITE queue + reconciliation and real mobile-browser testing (iOS Safari + Android Chrome) still pending
- 🟡 Writing-revision workspace — revision chain + revise flow shipped (Task 63); comprehensive revision-and-rubric system pending
- 🟡 Evidence-backed reference · 🟡 Content quality console (regression tests per flag pending)

### Polish (4 done, 6 partial — mistake-memory corrections closed the last pending clause)
- ✅ Review queue/FSRS (Task 56) · ✅ Talk v1 · ✅ Sound Lab (inference tier) · ✅ Mistake memory/mastery (Task 65 closed the row's last pending clause: learner-side corrections + provenance + tombstoned forgetting shipped)
- 🟡 Coach transparency · exam generation/grading · placement confidence · XP/gems/quests · progress reports · onboarding naming

### Reverse-engineering targets
- ✅ Anki · ✅ Duolingo · 🟡 ELSA (measured word-level acoustic tier shipped; phoneme tier awaits an Azure key) · ❌ LingQ (imported-reading workflow study)

### External stores / APIs (deliberately deferred, single-user era)
- ❌ PostgreSQL · ❌ Redis/Valkey · ❌ R2/S3 · ✅ LLM structured outputs · 🟡 Azure Speech (pronunciation-assessment adapter shipped, dormant until AZURE_SPEECH_KEY/REGION are set) · 🟡 Transactional email delivery guarantees

---

## 2. Stage plan (the audit's implementation order)

| Stage | Scope | Status |
|-------|-------|--------|
| 01 Stabilize and isolate | CI green, learner data isolation, auth hardening, safe migrations, **data survival across updates** | **CLOSED** — Tasks 45–48 + 57. The audit's 5 P0s plus the REG-1 data guard. Residual: CardState/arcade scoping rides the multi-user push (see §3 P0-architecture row). |
| 02 Make the learning system trustworthy | Account deletion, abuse limits, tool permissions, test isolation, degraded-result honesty | **5/5 closed** (Tasks 49–52 + 57's honest degraded states on every AI surface). |
| 03 Add the differentiators | BYO materials, curriculum graph, acoustic pronunciation, import interop | **CLOSED (single-learner era)** — all four shipped: BYO materials (Task 54, source-validated), CEFR B2–C1 graph with mastery gates (Task 58 — the earlier "pending" note here was stale), acoustic word-level tier (Task 64) with the Azure phoneme adapter config-gated, import interop CSV/TSV + `.apkg` (Tasks 55/59). Honest limits that remain are validation/config items, not missing code: phoneme tier awaits an Azure key, exam scores stay practice estimates until rubric validation (Task 66). |
| 04 Dependable daily product | Anki binary import, offline sync, reminders, longitudinal effectiveness evidence | **IN PROGRESS** — `.apkg` import shipped (Task 59), reminders shipped (PWA habit loop: local notifications, SHA-versioned caches), offline = partial (reads only), longitudinal effectiveness evidence = the P1 learner pilot (below). |

**Audit's score-lift doctrine (binding):** the next score increase must come from *validated teaching + real speech assessment*, NOT another batch of unrelated features. Passing CI proves engineering behavior, not educational effectiveness.

---

## 3. Next-wave priorities (evaluator 2026-10-22, reconciled with the incident log)

| Priority | Remaining work | Status |
|----------|----------------|--------|
| P0 — privacy | **Stop publishing live learner DB snapshots; private backups only** | **CLOSED (Task 62)** — vault repo + history scrub; email treated as exposed |
| P0 — architecture | Real per-user data isolation before public multi-user | **PARTIAL — content surfaces complete (Tasks 63+65)**: chats, essays, transcripts, review logs, the mistake memory (families + corrections + tombstones), the mastery ledger, daily activity stats, goals and all state-route counts are stamped + filtered per user, proven by the two-account battery. Residual for the next wave: CardState (the FSRS deck queue) and arcade meta tables (Quest/GameStat/League/Rival/Achievement/RunState) are still global keys — aggregate state, no learner prose, safe only while the deployment lock holds |
| P1 — learning quality | Genuine acoustic pronunciation assessment | **DONE (Task 64) — decision shipped in code**: built-in measured word-level tier (server ASR → deterministic alignment, TTS→ASR roundtrip-validated, real-clip E2E at 100/100) + Azure phoneme-assessment adapter dormant until the learner sets AZURE_SPEECH_KEY/REGION; no phoneme claims anywhere until then |
| P1 — curriculum | Authentic IELTS/TOEFL/C1A tracks | **PARTIAL — format tracks shipped (Task 66)**: IELTS/TOEFL/C1 Advanced-style practice built on the existing exam engine (per-track task-type mix + rubric in the generation prompt, deterministic rough band reference on grading, not-affiliated disclaimers everywhere, skill routing in the coach). Honest limit: format-faithful GENERATED practice, not licensed past papers - those stay out of scope for a zero-licensing app |
| P1 — reliability | Offline sync + real mobile-browser testing | **PARTIAL (PWA wave + Task 67 qualification)** — offline SHELL + cached reads are real (manifest + SW with SHA-versioned caches, offline reload renders the app, /api/version never cached, test-pwa 12/12); what is NOT shipped: an offline WRITE queue with reconciliation (actions taken offline still die with the connection) and real mobile-browser testing on iOS Safari + Android Chrome. Roadmap #20 stays open until writes survive offline |
| P2 — depth | Learner-memory corrections, goal planner | **DONE (Task 65)** — memory corrections: Mind Reader correct (edit quoted evidence/label, editedAt provenance) + forget with a tombstone (the exact rejected pair never re-aggregates; new evidence still reopens the family); goal planner: deterministic weekly plan from FSRS due-load forecast + observed 14-day rhythm + mastery danger tags, honest feasibility (on_track/tight/overcommitted with numbers), archive-never-delete. Writing revision history DONE (Task 63) |
| P2 — operations | Transactional email delivery reporting + idempotency | **DONE (Task 63)** — MailLog ledger (one row per recipient+kind = the delivery report), sliding-window idempotency, SMTP messageId reporting |

### Bookkeeping (Task 67, 2026-10-22) — the canonical category ledger

The evaluator's third re-review replaced the flat 39-item count with per-category totals (the old flat counts double-counted overlapping work). **This table is the canonical top-level ledger; both roadmap files now carry it and agree.**

| Category | Done | Partial | Pending |
|----------|------|---------|---------|
| Original critical fixes | 10 | 0 | 0 |
| Critical feature additions (10) | 4 | 6 | 0 |
| Existing-feature polish (10) | 4 | 6 | 0 |
| Reverse-engineering benchmarks | 2 | 1 | 1 |
| Three recommended data stores | 0 | 0 | 3 |
| Three recommended API integrations | 2 | 1 | 0 |

Notes: (a) the critical-fix row is for the currently LOCKED single-learner deployment with documented security controls — PostgreSQL and the public-registration decision remain separate launch requirements; (b) category totals are not additive (features support more than one recommendation); (c) the polish row moved from the evaluator's 3/7 to 4/6 because Task 65's memory corrections closed that row's last pending clause AFTER the snapshot; (d) the evaluator's earlier 17/15/7 flat ledger and this wave's REG-2 closure (a privacy fix, not a feature) are superseded by this table. CI note kept for the record: pushes to main never triggered CI until Task 57-bis fixed the `on.push.branches` corruption.

### Open critical list (evaluator 2026-10-22, third re-review — reconciled)

1. **P0 — Finish the production database decision.** Per-user scoping is real (Tasks 63/65) but the app still runs SQLite, and registration stays locked. Before public multi-user: migrate to PostgreSQL, validate concurrent writes and migrations, and test isolation + recovery on the real deployment architecture. (Decision = PostgreSQL; the validation work is the remaining task.)
2. **P0 — Finish the privacy incident response.** Third-party caches of pre-scrub commits may survive the force-push. The published email is treated as EXPOSED (re-registration with it works, or claim a fresh address); remaining cached history should be checked and purged where possible; all future backups stay private (vault-only doctrine, opt-in encryption shipped in Task 63).
3. **P1 — Validate actual educational outcomes.** Passing tests proves the app behaves as coded, not that learners improve. Run a structured learner pilot tracking retention, writing quality, listening and speaking over several weeks (the effectiveness ledger supplies the zero-AI numbers).

### Two technical claims to keep precise (binding copy doctrine — verified in shipped code, Task 67)

1. **Pronunciation:** Rah scores actual recorded speech at the WORD level (`measured:asr-alignment` tier chip, ReadAloud.tsx). Until the Azure phoneme-assessment adapter is configured AND validated, no surface presents the score as a complete phonetic or accent assessment.
2. **Exam preparation:** the IELTS/TOEFL/C1A workflows carry not-affiliated + not-an-official-score disclaimers verbatim (`exam-tracks.ts`); their scores are PRACTICE ESTIMATES until grading is validated against expert-reviewed responses and exam-specific rubrics.

---

## 4. Decisions pending (the audit's "before more features" list)

1. **Single vs multi-user** — the deployment lock is the sanctioned interim; the real decision (multi-tenant Postgres with per-user scoping vs staying single-learner) gates the data-store stage. No date promised; the lock keeps either path safe.
2. **Azure AI Speech** — RESOLVED as a two-tier decision (Task 64): the measured word-level acoustic tier ships NOW on the built-in SDK ASR (zero new credentials, validated by roundtrip + real-clip E2E), and the Azure pronunciation-assessment adapter (HundredMark/Phoneme/Comprehensive, miscue on) ships config-gated — it activates the moment the learner sets AZURE_SPEECH_KEY + AZURE_SPEECH_REGION, no code changes, with the route degrading honestly to the word tier if Azure errors. Until a key exists, no phoneme-level claims are made anywhere in the UI.
3. **Learning-effectiveness measurement** — the audit's warning: proxy metrics (XP, streaks) prove engagement, not learning. The effectiveness ledger exists (zero-AI numbers); next step is retention-curve evidence tied to FSRS, surfaced to the learner without AI gloss.
