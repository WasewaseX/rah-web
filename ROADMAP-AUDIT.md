# ROADMAP AUDIT — combined master document

**Created:** 2026-10-21 · **Sources:** the October 2026 external engineering + product audit (rating 8.5/10, "overall: stabilize before expanding"), the pre-audit feature roadmap (Tasks 1–44), and the 2026-10-21 data-loss regression raised by the learner.
**Companion:** `ROADMAP-STATUS.md` holds the same items with full evidence links. This file is the single master: the plan, the complete checklist, and the regression log.

---

## 0. Regression log (newest first)

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

## 1. The audit's implementation order (stage plan)

| Stage | Scope | Status |
|-------|-------|--------|
| 01 Stabilize and isolate | CI green, learner data isolation, auth hardening, safe migrations, **data survival across updates** | **CLOSED** — Tasks 45–48 + 57. The audit's 5 P0s plus the REG-1 data guard. Residual: true per-user scoping = mega-update (see stage 01→03 bridge below). |
| 02 Make the learning system trustworthy | Account deletion, abuse limits, tool permissions, test isolation, degraded-result honesty | **4/5 closed** (Tasks 49–52). Remaining: model-provider failure recovery = durable task recovery + "degraded result" labeling. |
| 03 Add the differentiators | BYO materials, curriculum graph, acoustic pronunciation, import interop | **IN PROGRESS** — BYO materials shipped (Task 54, source-validated extraction), CSV/TSV import shipped (Task 55). Pending: full CEFR B2–C1 graph with mastery gates; Azure Speech acoustic tier. |
| 04 Dependable daily product | Anki binary import, offline sync, reminders, longitudinal effectiveness evidence | PENDING. `.apkg` binary import is the nearest item. |

**Audit's score-lift doctrine (binding):** the next score increase must come from *validated teaching + real speech assessment*, NOT another batch of unrelated features. Passing CI proves engineering behavior, not educational effectiveness.

## 2. Checklist status (audit's 39 items, consolidated)

Counts at last audit: **17 done / 15 partial / 7 not done.** Movement since: data-loss guard closed (REG-1), CI trigger fixed, BYO materials + CSV import shipped (already counted in the audit's totals). Current ledger below (D=done, P=partial, N=not done):

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | Learner data isolation | P | Deployment lock closes the hole; per-user scoping = mega-update |
| 2 | CI green **and triggering** | D | Tasks 45 + 57 (branch selector was corrupted; fixed) |
| 3 | No auth token in localStorage | D | Task 46 |
| 4 | Email-code auth hardened | D | Task 46 |
| 5 | Safe DB + versioned migrations | D | Task 47 (Postgres = mega-update) |
| 6 | AI endpoint abuse limits | D | Task 50 |
| 7 | Model-provider failure recovery | P | Backoff/retry exists; durable recovery + degraded labeling pending |
| 8 | Agent tool permissions + injection boundaries | D | Task 51 |
| 9 | Deletion / privacy / **backups** | D | Task 49 + Task 57 guard (REG-1) |
| 10 | Tests isolated from learner state | D | Task 52 |
| 11 | BYO-materials learning | D | Task 54 (v1; PDF/EPUB v2) |
| 12 | Full CEFR curriculum graph | P | 5-band map exists; B2–C1 graph + gates pending |
| 13 | Authentic exam tracks | P | Generic exams shipped; IELTS/TOEFL task types + rubrics pending |
| 14 | Anki/custom-deck import | P | CSV/TSV shipped (Task 55); `.apkg` binary v2 |
| 15 | Acoustic pronunciation assessment | P | Sound Lab inference tier honest; Azure Speech = decision gate |
| 16 | Real offline sync | N | Roadmap #20 |
| 17 | Goal-based weekly planner | P | Forecast + budget explain exist; full re-planner pending |
| 18 | Evidence-backed English reference | P | Cards have defs/examples/audio; provenance surfacing pending |
| 19 | Writing-revision workspace | P | Diagnosis exists; drafts/revision history pending |
| 20 | Content quality console | P | Flag lifecycle + coach triage shipped; per-flag regression tests pending |
| 21 | Review queue + FSRS polish | D | Tasks 44 + 56 (limits, suspend, undo) |
| 22 | Talk conversation mode | P | v1 done (Task 41); mobile quirks untested |
| 23 | Sound Lab | P | Inference tier done; acoustic tier = item 15 |
| 24 | AI coach transparency | P | Trace + flags + triage shipped; "why this" evidence pending |
| 25 | Exam generation/grading | P | Answerability + weakness targeting; item-bank validation pending |
| 26 | Placement/CEFR honesty | P | Proven-only bands; sample counts + uncertainty pending |
| 27 | Mistake memory/mastery | P | Families feed weakness bias; learner tag-correction pending |
| 28 | XP/gems/quests economy | P | Bot labeled; anti-farming pass pending |
| 29 | Progress reports | P | Zero-AI ledgers exist; spoken-fluency caveats pending |
| 30 | Onboarding/naming | P | Partial (badges/tooltips); full naming audit pending |
| 31 | Reverse-engineer: Duolingo | D | `DUOLINGO-RE.md`; tiles/streak/bot doctrine shipped |
| 32 | Reverse-engineer: Anki | P | Mechanics studied, TSV both ways; scheduling settings + `.apkg` pending |
| 33 | Reverse-engineer: ELSA Speak | P | Sound Lab = honest version; acoustic analysis pending |
| 34 | Reverse-engineer: LingQ | N | Next research target (imported-reading → vocab workflow) |
| 35 | PostgreSQL primary store | N | By design — coupled with per-user scoping |
| 36 | Redis/Valkey ops state | N | By design — needed only at multi-instance scale |
| 37 | R2/S3 object storage | N | By design — comes with the deployment push |
| 38 | LLM structured outputs | D | `aiJson` ladder + deterministic validation |
| 39 | Transactional email | P | SMTP path exists; delivery-failure reporting + idempotency pending |

**Ledger today (this table's classification): 12 D · 22 P · 5 N.** The audit's own baseline read **17 D / 15 P / 7 N**; the delta is classification strictness — several items the audit marked done are pinned here only at v1/honest-partial level (e.g. Talk v1, Sound Lab, review queue) — plus this wave's movement (data-loss guard REG-1, CI trigger fix, BYO materials Task 54, CSV import Task 55). The stricter ledger is the planning truth: it is what the score-lift doctrine measures against.

## 3. Decisions pending (the audit's "before more features" list)

1. **Single vs multi-user** — the deployment lock is the sanctioned interim; the real decision (multi-tenant Postgres with per-user scoping vs staying single-learner) gates the data-store stage. No date promised; the lock keeps either path safe.
2. **Azure AI Speech** — the only validated acoustic scoring path; gates Sound Lab v2 and items 15/33. Decision needed before "pronunciation" claims move from honest-inference to measured.
3. **Learning-effectiveness measurement** — the audit's warning: proxy metrics (XP, streaks) prove engagement, not learning. The effectiveness ledger exists (zero-AI numbers); next step is retention-curve evidence tied to FSRS, surfaced to the learner without AI gloss.
