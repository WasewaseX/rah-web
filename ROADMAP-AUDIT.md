# ROADMAP AUDIT — checklist, incidents, and open items

**Created:** 2026-10-20 (Task 60 wave) · **Updated:** 2026-10-21 (Task 61 wave: second wipe + layer merge) · **Companion to:** `ROADMAP-STATUS.md` (per-item evidence) · **Audience:** the builder + any future evaluator wave.

Purpose: one place that tracks (a) incident post-mortems with acceptance tests, (b) the standing audit checklist, (c) what an external evaluator praised vs. what actually broke. Update it every wave; do not let "DONE" claims outrun the drills that prove them.

---

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

## 1. Standing checklist (evaluator's October 20 update, reconciled)

Legend: ✅ done · 🟡 partial · ❌ not started · 🔺 NEW risk found this wave.

### Critical fixes (9/10 closed + 1 hole found and closed)
- ✅ Green GitHub CI (Task 45)
- ✅ No browser-readable auth tokens (Task 46)
- ✅ Secure email verification codes (Task 46)
- 🟡→✅ Safe database — evaluator's ✅ was **half true** 🔺: schema migrations safe, data persistence broken. Closed by Tasks 60+61 (see incident log; the second wipe proved the fix must also survive stale reprovisions).
- ✅ AI endpoint rate limits (Task 50)
- ✅ AI-provider failure recovery (Task 57)
- ✅ Agent permissions + prompt-injection defenses (Task 51)
- ✅ Account deletion + privacy cleanup (Task 49)
- ✅ Isolated automated tests (Task 52)
- 🟡 Learner data isolation — deployment lock in place (Task 48); per-user scoping + two-user tests still pending (multi-user mega-update).

### Critical features (3 done, 5 partial, 2 pending)
- ✅ Bring-your-own-materials (Task 54) · ✅ CEFR curriculum graph (Task 58) · ✅ Anki .apkg import (Task 59)
- 🟡 Exam tracks (IELTS/TOEFL/C1A) · 🟡 Acoustic pronunciation assessment · 🟡 Evidence-backed reference · 🟡 Writing-revision workspace · 🟡 Content quality console
- ❌ Offline sync · ❌ Goal-based weekly planner

### Polish (3 done, 7 partial)
- ✅ Review queue/FSRS (Task 56) · ✅ Talk v1 · ✅ Sound Lab (inference tier)
- 🟡 Coach transparency · exam generation/grading · placement confidence · mistake memory · XP/gems/quests · progress reports · onboarding naming

### Reverse-engineering targets
- ✅ Anki · ✅ Duolingo · 🟡 ELSA (acoustic tier missing) · ❌ LingQ (imported-reading workflow study)

### External stores / APIs (deliberately deferred, single-user era)
- ❌ PostgreSQL · ❌ Redis/Valkey · ❌ R2/S3 · ✅ LLM structured outputs · ❌ Azure Speech · 🟡 Transactional email delivery guarantees

## 2. Next-wave priorities (in evaluator's order, reconciled with this incident)

1. ~~Data survives updates~~ → **Tasks 60+61 closed the P0**; keep both drills green every wave, and ALWAYS start a session with the git sync (the stale-reprovision lesson).
2. Per-user ownership/scoping + PostgreSQL (unblocks public multi-user; also shrinks the snapshot-window risk class).
3. True acoustic pronunciation assessment (evaluate Azure Speech against real learner audio; honesty gates like Sound Lab's).
4. Authentic exam task structures + rubric validation against expert-reviewed examples.
5. Prove learning effectiveness (retention/writing/listening/speaking over time) — CI green ≠ teaching works.
