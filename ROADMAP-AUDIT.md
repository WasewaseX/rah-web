# ROADMAP AUDIT — checklist, incidents, and open items

**Created:** 2026-10-20 (Task 60 wave) · **Companion to:** `ROADMAP-STATUS.md` (per-item evidence) · **Audience:** the builder + any future evaluator wave.

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

---

## 1. Standing checklist (evaluator's October 20 update, reconciled)

Legend: ✅ done · 🟡 partial · ❌ not started · 🔺 NEW risk found this wave.

### Critical fixes (9/10 closed + 1 hole found and closed)
- ✅ Green GitHub CI (Task 45)
- ✅ No browser-readable auth tokens (Task 46)
- ✅ Secure email verification codes (Task 46)
- 🟡→✅ Safe database — evaluator's ✅ was **half true** 🔺: schema migrations safe, data persistence broken. Closed by Task 60 (see incident log).
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

1. ~~Data survives updates~~ → **Task 60 closed the P0**; keep the drill green every wave.
2. Per-user ownership/scoping + PostgreSQL (unblocks public multi-user; also shrinks the snapshot-window risk class).
3. True acoustic pronunciation assessment (evaluate Azure Speech against real learner audio; honesty gates like Sound Lab's).
4. Authentic exam task structures + rubric validation against expert-reviewed examples.
5. Prove learning effectiveness (retention/writing/listening/speaking over time) — CI green ≠ teaching works.
