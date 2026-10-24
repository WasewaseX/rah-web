# ROADMAP AUDIT — checklist, incidents, and open items

**Created:** 2026-10-20 (Task 60 wave) · **Updated:** 2026-10-24 (**Task 92-ter reconciliation**: the dual-userId ledger split recorded as its own bookkeeping entry below with the post-review verification pass; the newest October 24 review — 8.7/10 product, 9.5/10 engineering, 6.8/10 production readiness — acknowledges Task 92-ter as CI-green and re-affirms the three standing priorities; Tasks 90/91/91-b/92/92-bis records also folded in) · **Companion to:** `ROADMAP-STATUS.md` (per-item evidence) · **Audience:** the builder + any future evaluator wave.

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

**ADDENDUM 3 (Task 75, 2026-10-22) — the dangling-commit sweep: the scrub is complete on the history, but GitHub still serves the past by hash.** The auditor's warning ("third-party caches of earlier commits may survive") was probed with evidence, not assumed:

- **15 of 16 pre-scrub SHAs are STILL RETRIEVABLE** via `GET /repos/WasewaseX/rah-web/commits/<sha>` (dangling objects on GitHub's side): 4d4f582, 240100a, 0c02959, 0e9100e, 3b2049f, d1722f7, 161d7cb, f52e593, cd35f15, 3e49329, 6b9fda4, 5156b4b, b02be56, 79ac327, ab9514a. Only 9b9c360 is gone.
- **WORST FINDING: the leaked snapshot itself is anonymously fetchable at 5156b4b** (the Task-60 era commit that carried `db/sync/rah-latest.db`): `raw.githubusercontent.com/WasewaseX/rah-web/5156b4b/db/sync/rah-latest.db` returns **HTTP 200, 217,088 bytes, NO authentication**, and the whole pre-scrub tree downloads via `codeload.github.com/.../tar.gz/5156b4b`. At every OTHER dangling SHA the snapshot paths 404 (the leak window was Oct-20 18:57 through Task 60's commit range; the audit's 14-row sizing applies to this blob).
- Clean re-verifications: public events API carries zero pre-scrub SHAs; the public tree carries ZERO learner-data paths; the vault repo is `private=true`; nothing is LISTED anywhere — every exposure requires knowing a hash.

**What this means (honest):** the history rewrite did its job for anyone browsing or pulling the repo; it CANNOT expunge GitHub's object CDN. The email + first-session progress must be treated as EXPOSED (standing doctrine since REG-2). The one remaining human action is the account holder filing GitHub Support's "remove sensitive data" (trailing/cached views) request — it cannot be filed from inside the sandbox. Template (ready to paste):

> Subject: Purge dangling commits and cached views after a force-push (sensitive data removal)
>
> Repo: WasewaseX/rah-web (public). We rewrote history via git filter-repo and force-pushed (old tip 9b9c360). The following PRE-REWRITE commits are still retrievable by hash via the contents API, raw.githubusercontent.com and codeload tarballs, and one still serves a sensitive SQLite file (db/sync/rah-latest.db containing a user email address):
>
> [paste the 15 SHAs above, one per line]
>
> Please run a GC / purge these unreachable objects and cached views from all endpoints (API, raw CDN, codeload, web UI). We understand the objects are not linked from any branch or tag.

Re-run the sweep any time: `python3 scripts/privacy-sweep.py` (exit 1 = human action still pending). This addendum closes the SWEEP half of incident-response item #2; the purge-request half stays open until the learner files it and the sweep returns clean.

**Re-run evidence (Task 88, 2026-10-23):** 15/16 pre-scrub SHAs still dangling-retrievable; the leaked snapshot blob is STILL served at 5156b4b; vault private=True; public tree still carries zero learner-data paths; events API clean. State UNCHANGED from the Task-75 sweep — the Support purge remains the single remaining human action. The sweep is now MONITORED, not manual: `watchdog.sh`'s daily tick runs `scripts/privacy-sweep-watchdog.sh`, which appends a date-stamped evidence line to gitignored `db/privacy-sweep.log` and flips to "CLEAN - can be closed" the day the purge lands.

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

### Critical fixes (10/10 closed — isolation residual closed by the parallel wave's Task 67)
- ✅ Green GitHub CI (Task 45)
- ✅ No browser-readable auth tokens (Task 46)
- ✅ Secure email verification codes (Task 46)
- 🟡→✅ Safe database — evaluator's ✅ was **half true** 🔺: schema migrations safe, data persistence broken. Closed by Tasks 60+61 + 57-bis (three wipes total; see incident log). **REG-2 amendment (2026-10-22):** the survival fix itself leaked learner data into the public repo — closed by moving ALL snapshots to the private vault repo and scrubbing public history.
- ✅ AI endpoint rate limits (Task 50)
- ✅ AI-provider failure recovery (Task 57)
- ✅ Agent permissions + prompt-injection defenses (Task 51)
- ✅ Account deletion + privacy cleanup (Task 49)
- ✅ Isolated automated tests (Task 52)
- ✅ Learner data isolation — deployment lock in place (Task 48) AND per-user scoping complete (Tasks 63+65+67): every learning table carries userId (content, memory, stats, goals, and as of Task 67 the FSRS queue, arcade meta, skill bands, placement history, imported materials), reads/deletes scoped, two-account battery 45/45. Remaining before public multi-user: the Postgres move + the lock decision itself.

### Critical features (7 done, 3 partial — headings reconciled to the ledger, Task 92)
- ✅ Bring-your-own-materials (Task 54) · ✅ CEFR curriculum graph (Task 58) · ✅ Anki .apkg import (Task 59) · ✅ Goal-based weekly planner (Task 65: FSRS due-load forecast + observed rhythm + honest feasibility, deterministic)
- 🟡 Exam tracks (IELTS/TOEFL/C1A) — format-faithful tracks shipped (Task 66); **scores are practice estimates** until grading is validated against expert-reviewed responses and exam-specific rubrics
- 🟡 Acoustic pronunciation assessment — **word-level measured tier shipped (Task 64)**; NOT a complete phonetic/accent assessment until the Azure phoneme adapter is configured AND validated
- 🟡 Offline sync — **the daily-habit write loop is offline now (Task 68)**: gid-receipt grade idempotency (replays return the original response, nothing double-counts), client outbox, reconnect flush, honest badge + PWA offline shell/reads; Task 78 extended the queue to the SOLO arcade aggregates (speed/boss/duel/pairs/flow via generic gid receipts; battery 433/433); the honest boundary is now: dungeon/gauntlet (server-dealt state machines), chats/writings/speak (need the model) refuse offline by design, and physical-device spot-check beyond emulation is pending
- ✅ Writing-revision workspace — revision chain + revise flow (Task 63) + criterion-level rubric history (Task 77) + per-revision change summaries (Task 83: fixed/remaining/introduced with the grader's own corrections as evidence)
- ✅ Evidence-backed reference (Task 79) · ✅ Content quality console (Task 80: per-flag regression instrument + batteries)

### Polish (10 done, 0 partial — headings reconciled to the ledger, Task 92)
- ✅ Review queue/FSRS (Task 56) · ✅ Talk v1 · ✅ Sound Lab (inference tier) · ✅ Mistake memory/mastery (Task 65) · ✅ Coach transparency — verified already-shipped (Task 72: next-best actions carry per-action measured reasons) · ✅ Placement confidence (Task 72: per-skill sample counts + stated uncertainty) · ✅ Progress reports (Task 70: first-try recall curve + standing proxy-metric caveat) · ✅ XP/gems/quests anti-farming (Task 72: per-mode daily XP budgets, 25% engagement floor, ledger==sum-of-paids invariant)
- ✅ Exam generation/grading (Task 81) · ✅ Onboarding/naming (Task 82: the naming registry + on-screen glosses + bot chips everywhere)

### Reverse-engineering targets (4 done, 1 partial)
- ✅ Anki · ✅ Duolingo · ✅ LingQ (Task 71: RE study + MaterialReader imported-reading workflow — tap-to-lookup in context, grades through the same FSRS queue, offline-safe via the outbox; per-token known-word ledger deliberately not copied, honest reason recorded) · ✅ Grammarly (Task 85: live revision-and-rubric writing surface — offset-anchored pre-flight while typing, deterministic accept-splice, register goals, practice-estimate strip; the proprietary 0-100 score/tone detector/plagiarism loops deliberately not copied with reasons recorded) · 🟡 ELSA (measured word-level acoustic tier shipped; phoneme tier awaits an Azure key)

### External stores / APIs (deliberately deferred, single-user era)
- ❌ PostgreSQL · ❌ Redis/Valkey · ❌ R2/S3 · ✅ LLM structured outputs · 🟡 Azure Speech (pronunciation-assessment adapter shipped, dormant until AZURE_SPEECH_KEY/REGION are set) · ✅ Transactional email delivery ledger + idempotency (Task 63; SMTP credentials remain a config gap, not a code gap)

---

## 2. Stage plan (the audit's implementation order)

| Stage | Scope | Status |
|-------|-------|--------|
| 01 Stabilize and isolate | CI green, learner data isolation, auth hardening, safe migrations, **data survival across updates** | **CLOSED** — Tasks 45–48 + 57; the isolation residual (CardState/arcade/bands/materials) closed by the wave's Task 67 (isolation battery 45/45). Structural remainder before public multi-user: the Postgres move + the lock decision (open critical list below). |
| 02 Make the learning system trustworthy | Account deletion, abuse limits, tool permissions, test isolation, degraded-result honesty | **5/5 closed** (Tasks 49–52 + 57's honest degraded states on every AI surface). |
| 03 Add the differentiators | BYO materials, curriculum graph, acoustic pronunciation, import interop | **CLOSED (single-learner era)** — all four shipped: BYO materials (Task 54, source-validated), CEFR B2–C1 graph with mastery gates (Task 58 — the earlier "pending" note here was stale), acoustic word-level tier (Task 64) with the Azure phoneme adapter config-gated, import interop CSV/TSV + `.apkg` (Tasks 55/59). Honest limits that remain are validation/config items, not missing code: phoneme tier awaits an Azure key, exam scores stay practice estimates until rubric validation (Task 66). |
| 04 Dependable daily product | Anki binary import, offline sync, reminders, longitudinal effectiveness evidence | **IN PROGRESS** — `.apkg` import shipped (Task 59), reminders shipped (PWA habit loop), offline grade loop shipped (Task 68), first longitudinal evidence shipped (Task 70: first-try recall curve); remaining: offline queue beyond grades, the structured multi-week pilot |

**Audit's score-lift doctrine (binding):** the next score increase must come from *validated teaching + real speech assessment*, NOT another batch of unrelated features. Passing CI proves engineering behavior, not educational effectiveness.

---

## 3. Next-wave priorities (evaluator 2026-10-22, reconciled with the incident log)

| Priority | Remaining work | Status |
|----------|----------------|--------|
| P0 — privacy | **Stop publishing live learner DB snapshots; private backups only** | **CLOSED (Task 62)** — vault repo + history scrub; email treated as exposed |
| P0 — architecture | Real per-user data isolation before public multi-user | **CLOSED (Tasks 63+65+67)** — every learning table carries userId: chats, essays, transcripts, review logs, mistake memory, mastery ledger, daily stats, goals, AND (Task 67) the FSRS deck queue, arcade meta (quests/trophies/game records/rival/league/runs), measured skill bands, placement history and imported materials. Account deletion removes the caller's learner rows in both branches. Proven by the two-account isolation battery 45/45 (queue cross-user blindness, trophies, speed records, per-user quests/rival rows, placement bands, material 404s). Structural remainder: the Postgres move + the deployment-lock decision |
| P1 — learning quality | Genuine acoustic pronunciation assessment | **DONE (Task 64) — decision shipped in code**: built-in measured word-level tier (server ASR → deterministic alignment, TTS→ASR roundtrip-validated, real-clip E2E at 100/100) + Azure phoneme-assessment adapter dormant until the learner sets AZURE_SPEECH_KEY/REGION; no phoneme claims anywhere until then |
| P1 — curriculum | Authentic IELTS/TOEFL/C1A tracks | **PARTIAL — format tracks shipped (Task 66)**: IELTS/TOEFL/C1 Advanced-style practice built on the existing exam engine (per-track task-type mix + rubric in the generation prompt, deterministic rough band reference on grading, not-affiliated disclaimers everywhere, skill routing in the coach). Honest limit: format-faithful GENERATED practice, not licensed past papers - those stay out of scope for a zero-licensing app |
| P1 — reliability | Offline sync + real mobile-browser testing | **SUBSTANTIALLY DONE (Tasks 68+69) — honest residual recorded** — offline GRADE loop end-to-end: gid-stamped outbox → server GradeAck receipts (replays return the ORIGINAL response, nothing double-counts), reconnect flush on online/visibility/mount, honest badge; whole app driven in a real headless mobile browser at iPhone-14 emulation (390×844, DPR3, touch, mobile UA) with fixes shipped (the nav-trapped grade grid was UNREACHABLE — measured with elementFromPoint — plus tap-target fixes) and an on-device offline E2E (grade offline → queued → reconnect → ReviewLog row with the same gid). Residual: the offline queue covers the review loop; chats/writings/arcade scores refuse offline honestly; physical-device spot-check beyond emulation pending |
| P2 — depth | Learner-memory corrections, goal planner | **DONE (Task 65)** — memory corrections: Mind Reader correct (edit quoted evidence/label, editedAt provenance) + forget with a tombstone (the exact rejected pair never re-aggregates; new evidence still reopens the family); goal planner: deterministic weekly plan from FSRS due-load forecast + observed 14-day rhythm + mastery danger tags, honest feasibility (on_track/tight/overcommitted with numbers), archive-never-delete. Writing revision history DONE (Task 63) |
| P2 — operations | Transactional email delivery reporting + idempotency | **DONE (Task 63)** — MailLog ledger (one row per recipient+kind = the delivery report), sliding-window idempotency, SMTP messageId reporting |

### Bookkeeping (Task 73, 2026-10-22) — the canonical category ledger (post-wave)

The evaluator's third re-review replaced the flat 39-item count with per-category totals (the old flat counts double-counted overlapping work). **This table is the canonical top-level ledger; both roadmap files now carry it and agree.**

| Category | Done | Partial | Pending |
|----------|------|---------|---------|
| Original critical fixes | 10 | 0 | 0 |
| Critical feature additions (10) | 7 | 3 | 0 |
| Existing-feature polish (10) | 10 | 0 | 0 |
| Reverse-engineering benchmarks | 4 | 1 | 0 |
| Three recommended data stores | 0 | 0 | 3 |
| Three recommended API integrations | 2 | 1 | 0 |

Notes: (a) the critical-fix row is for the currently LOCKED single-learner deployment with documented security controls — PostgreSQL and the public-registration decision remain separate launch requirements; (b) category totals are not additive (features support more than one recommendation); (c) deltas vs the evaluator's snapshot (features 4/6, polish 3/7, RE 2/1/1): Task 65 closed memory corrections, Tasks 70+72 closed progress reports / placement confidence / coach transparency / anti-farming, Task 71 closed LingQ, Task 85 closed Grammarly (writing editor now a live revision-and-rubric surface: offset-anchored pre-flight, deterministic accept-splice, register goals, practice-estimate strip) — offline stays PARTIAL because the shipped offline loop covers grades, not every write surface; (d) the evaluator's earlier 17/15/7 flat ledger is superseded by this table. CI note kept for the record: pushes to main never triggered CI until Task 57-bis fixed the `on.push.branches` corruption.

### Bookkeeping (Task 92, 2026-10-24) — October 24 re-review reconciliation + real-environment proof day

The evaluator's October 24 re-review (8.6/10 product, 9.4/10 engineering, 6.8/10 production readiness) re-affirmed the three priorities (privacy purge, PG cutover, teaching validation) and added: reconcile this audit with the tested state. What Task 92 did, with evidence:

1. **Claims-vs-diff gate** — Tasks 90/91/91-b SHAs fixed and diff-verified (9ff9133: 14 files incl. instrumentation.ts + proxy.ts; 95779d3: App.tsx lazy-loading + build-prod.sh + repair/vault fixes; 043c0a6: package.json/bun.lock prune).
2. **Recovery drills re-run on the live deployment (all GREEN)** — phase 2 (FSRS-only loss: schedule + DailyStat restored insert-only, ReviewLog untouched), phase 2b (no-clobber partial loss + idempotent second boot), phase 3 (fresh git clone → install → real boot serves the LIVE learner: xp=394, streak=4, createdAt tripwire 2026-10-20), phase 4a/b/c (vault private, snapshots scrubbed Session=0/LoginCode=0, vault-ONLY boot restore). Today's environment recycle ALSO exercised the real boot chain live: boot guard restored the fresh DB from the offsite mount, integrity OK (db/boot-guard.log 22:26 UTC).
3. **PostgreSQL: the COMPLETE migration + restore rehearsal ran on the actual deployment** (not just the sandbox): userspace PG 16.2 with TCP → schema (30 tables/21 indexes) → live-data COPY → 30/30 counts match, checksum identical (xp=394/streak=4) → the standalone prod bundle REBUILT with a PostgreSQL client booted on :3100 and served the authenticated learner (state 200 + coach 200) → pg_dump/drop/recreate/restore → verify GREEN. **Three drill-found flip gaps fixed and codified in scripts/pg-cutover.sh**: (G1) the .env swap alone boots a SQLite query engine — provider switch + client regenerate + bundle rebuild are now flip steps; (G2) the migration history is SQLite-locked (P3019) — the flip now creates a one-time PG baseline history and preserves the SQLite history aside; (G3) pg_copy_data.py's verify parsed psql's "(N rows)" footer as the count (-1 false mismatch) — fixed with tuples-only output. The physical flip on the live deployment remains a DECISION gated on the multi-user launch; the runbook is now complete and drill-hardened.
4. **Real-user loading measured (the review's "not bundle size alone")** — new harness scripts/load-metrics.mjs (real Chromium, iPhone 13 emulation, 4x CPU throttle, 1.6Mbps/150ms): COLD FCP 2564ms → **1128ms (−56%)**, WARM FCP 456ms → 220ms (−52%), DCL/bytes unchanged. Root cause found with scripts/paint-probe.mjs: the SSR shell painted only a bare spinner (Chrome does not count spinners as contentful), so first contentful paint waited for hydration. The boot splash now renders the branded wordmark (identical SSR/client markup, zero layout shift).
5. **Privacy sweep re-run 2026-10-24**: 15/16 pre-scrub SHAs still dangling-retrievable, blob STILL SERVED at 5156b4b — but **9b9c360 is now GONE (first observed purge progress)**. The GitHub Support purge remains the human action; the watchdog keeps daily evidence in db/privacy-sweep.log.
6. **Security re-verified live**: all 12 learner-data endpoints return 401 to anonymous callers on the prod build; /api/version + auth legs public. Gates: guard 58/58, isolated battery 441/441 (one transient 438 caused by external LanguageTool unavailability — re-run green), isolation 45/45, tsc 0, eslint 0.

### Bookkeeping (Task 92-bis, 2026-10-24) — reconciliation verified against code + the measured interactivity round

1. **The reviewer's count-conflict callout was CONFIRMED and fixed at the row level**: STATUS §3 polish rows #4/#6/#8/#9 still said PARTIAL/pending while this ledger said polish 10/0/0. All four verified against shipped code before flipping (anti-farming `awardGameXp` arcade.ts:491 + 7 routes; placement sample-count honesty Progress.tsx:256; the proxy-metric standing block Progress.tsx:713-719; per-action measured reasons next-best.ts:47-135). STATUS stage-04's stale "offline = reads only" corrected to the Task-68/78/69 reality; gate-status guard count 53→58; §8 carries a living-doc pointer.
2. **PG decision packaged**: PG-DECISION.md — proven-what table, Option A/B consequences, one-command flip + pre-flight + proven rollback. The remaining P0 is a signature, not engineering.
3. **Azure claim boundary pinned by battery**: pronunciation battery 19→23/23 (hermetic degradation-contract pins: keys-set-but-erroring → adapter rejects → route degrades to the word tier; dormancy + env restore pinned).
4. **Mobile perf round 2 (measured)**: new interactivity harness (iPhone 13 emulation, 4x CPU, throttled network). BEFORE: first lazy-tab open settled at 1300ms; AFTER a zero-FCP-cost prefetch (pointerdown + authenticated idle): 83ms (77ms on re-run); TBT and FCP unchanged. Evidence: db/interactivity-{before,after}-92bis.json.
5. **Pilot cadence automated**: the watchdog appends the weekly `pilot-metrics` snapshot to db/pilot/series.md every 7 days — the series can no longer rot.

### Bookkeeping (Task 92-ter, 2026-10-24) — the dual-userId ledger split: closed in code + data + battery, verified by the reviewer and re-verified post-review

1. **The bug and why it mattered**: the coach-agent route (the Task-63 isolation sweep's straggler — it postdated the chat route's stamping) wrote ChatMsg with the schema default 'me' while session-scoped writes elsewhere resolved the authenticated User cuid — user-keyed rows split across TWO ids, so cuid-scoped readers (Progress, the volume card) could not see 17 real reviews or the listening ledger row while the learner kept earning xp. Found via `scripts/freshness-check.py` flagging xp growth with no DailyStat row under the expected id; the newest review (8.7/10, October 24) confirms this fix as CI-green (commits `02248f0` + `c3820ea`).
2. **Code fix**: both coach-agent ChatMsg creates stamp `contentUserId(req)`; isolation battery 45 → **47/47** (new pins: a coach turn through the agent route must stamp the session user, never 'me').
3. **Data fix**: `scripts/merge-legacy-user-rows.py` (read-only default, `--apply` gated, one transaction, idempotent, tripwire-guarded, copy-tested first — a bindings-order bug was caught by the copy test and never touched live): **78 rows re-id'd, 10 PK collisions field-merged** (DailyStat=sum, GameStat=best/plays-sum, Quest=progress-capped/done-OR/xp-max, Achievement=earliest-at), zero legacy rows left, Learner.createdAt tripwire unchanged.
4. **Follow-up (`c3820ea`)**: freshness-check now resolves the REAL ledger user (the auth cuid), not the legacy 'me' id — the post-merge chain would have false-greened on all-zero 'me' reads.
5. **Post-review verification pass (this session, 2026-10-24, post-8.7-review)**: claims-vs-diff on `02248f0`+`c3820ea` matches the reviewer's description exactly (6 files; 211-line merge script; battery +2); live data verified — zero 'me' rows across all user-keyed tables (ReviewLog 18, ChatMsg 26, CardState 18, DailyStat 5, GameStat 16, Quest 12, Achievement 1, all on the single auth cuid); batteries re-run green (isolation 47/47, guard 58/58, main 441/441, tsc 0, eslint 0); freshness chain LIVE==SYNC==VAULT==UPLOAD (xp=435/streak=5/reviews=18/days=5, MATCH+SCRUBBED); pilot metrics re-run on the merged identity (18 first attempts @33% recall week-0, 39 total reviews, 5 active days); prod rebuilt from HEAD (BUILD_ID O6YSPWco) + clean flip, boot regression ALL PASS, anonymous 401 gate live (all probed learner endpoints 401; version+auth public), chunks 200; mobile probes re-run on the fresh build: cold FCP median 1124ms, warm 200ms, first lazy-tab settle 82ms with 0 chunk bytes on the wire (idle-prefetch hit) — the reviewer-cited numbers reproduce. **Privacy sweep re-run: 15/16 dangling, blob STILL SERVED at 5156b4b (unchanged) — the purge remains the human action; the ready-to-file request is now pre-filled at `download/GITHUB-SUPPORT-PURGE-REQUEST.md`.** PG-DECISION.md updated with the 92-ter identity-split closure as multi-user evidence (isolation 47/47).

### Open critical list (evaluator 2026-10-22, third re-review — reconciled)

1. **P0 — Finish the production database decision.** Per-user scoping is complete (Tasks 63/65/67) but the app still runs SQLite, and registration stays locked. **Decision = PostgreSQL; the validation work is DONE (Task 74, on a real PostgreSQL 17.5 server):** the full 30-table datamodel applies cleanly via `prisma migrate diff` (schema.postgres.prisma variant, client generated to a separate output — the app's SQLite client untouched); the grade route's exact transaction shape ran 200 concurrent transactions (8 workers) at ~341 tx/s with ZERO lost updates (atomic XP increment, exact ReviewLog/DailyStat/CardState aggregates); the GradeAck gid race (12 concurrent same-gid creates) lets exactly ONE win on the PK with 11 honest P2002s — the offline-replay idempotency holds on PG; per-user scoped reads/deletes behave identically; a whole-DB logical restore into a second database matches per-table counts across all 30 tables; and the REAL cutover script (`scripts/sqlite-to-postgres.mjs`, SQLite opened READ-ONLY) migrated the live learner data (58 rows, all 30 tables, zero mismatches, zero dropped columns; xp=220/streak=2 verified on the PG side). Honest negatives recorded: the SQLite migration SQL does NOT run on PG (dialect) — the cutover baselines via `migrate diff`, which is exactly what was proven; what remains is the PHYSICAL flip on the real deployment (provision managed Postgres, baseline migrations, run the cutover in maintenance mode, flip the lock decision) — deployment-architecture work that cannot be completed inside this sandbox.
2. **P0 — Finish the privacy incident response.** **SWEEP DONE (Task 75, evidence in REG-2 addendum 3):** 15/16 pre-scrub SHAs confirmed dangling-retrievable, and the leaked snapshot blob is anonymously fetchable by hash at 5156b4b (raw CDN + codeload, 217 KB) — the auditor's cache warning is now EVIDENCE, not assumption. The published email stays treated as EXPOSED. **Remaining: one human action — the account holder files GitHub Support's sensitive-data removal with the ready-made template (incident log); `scripts/privacy-sweep.py` re-runs until it exits 0.** All future backups stay private (vault-only doctrine, opt-in encryption shipped in Task 63). **Re-run evidence (this session, 2026-10-24, post-92-ter): 15/16 dangling, blob STILL SERVED — unchanged; one commit (9b9c360) previously disappeared (purge progress). The filing friction is now zero: `download/GITHUB-SUPPORT-PURGE-REQUEST.md` carries the FULLY PRE-FILLED request (the 15 SHAs inline, blob evidence URLs, filing steps, closure criteria).**
3. **P1 — Validate actual educational outcomes.** **PROTOCOL + INSTRUMENT SHIPPED (Task 76):** `PILOT-PROTOCOL.md` pre-registers the verdict criteria (retention / writing / listening / speaking tracks, >=50-attempts-per-week verdict rule, small-sample honesty labels, failure handling, and an explicit can-not-prove section) and `scripts/pilot-metrics.mjs` computes the weekly zero-AI snapshot from the real tables. **Week-0 baseline recorded** (2026-10-22): 17 first attempts @ 29% recall, 2 active days, 17 cards / 9 lapses, no writing/speaking/dictation volume yet — honestly flagged as small samples. What remains is TIME, not code: the pilot runs over the coming weeks (minimum 4, target 8) by re-running the instrument weekly; the Task 70 recall curve gives the learner the in-app view.

### Two technical claims to keep precise (binding copy doctrine — verified in shipped code, Task 73)

1. **Pronunciation:** Rah scores actual recorded speech at the WORD level (`measured:asr-alignment` tier chip, ReadAloud.tsx). Until the Azure phoneme-assessment adapter is configured AND validated, no surface presents the score as a complete phonetic or accent assessment.
2. **Exam preparation:** the IELTS/TOEFL/C1A workflows carry not-affiliated + not-an-official-score disclaimers verbatim (`exam-tracks.ts`); their scores are PRACTICE ESTIMATES until grading is validated against expert-reviewed responses and exam-specific rubrics.

---

## 4. Decisions pending (the audit's "before more features" list)

1. **Single vs multi-user** — the deployment lock is the sanctioned interim; the real decision (multi-tenant Postgres with per-user scoping vs staying single-learner) gates the data-store stage. No date promised; the lock keeps either path safe.
2. **Azure AI Speech** — RESOLVED as a two-tier decision (Task 64): the measured word-level acoustic tier ships NOW on the built-in SDK ASR (zero new credentials, validated by roundtrip + real-clip E2E), and the Azure pronunciation-assessment adapter (HundredMark/Phoneme/Comprehensive, miscue on) ships config-gated — it activates the moment the learner sets AZURE_SPEECH_KEY + AZURE_SPEECH_REGION, no code changes, with the route degrading honestly to the word tier if Azure errors. Until a key exists, no phoneme-level claims are made anywhere in the UI.
3. **Learning-effectiveness measurement** — the audit's warning: proxy metrics (XP, streaks) prove engagement, not learning. The effectiveness ledger exists (zero-AI numbers); the FIRST retention-curve evidence shipped (Task 70: per-day first-attempt good rate, small-sample days dimmed and labeled); next step is the structured multi-week pilot.
