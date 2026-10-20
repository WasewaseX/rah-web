# ROADMAP AUDIT — Rah Web

**Created:** 2026-10-21 · **Trigger:** learner report — *"first word achievement fired AGAIN after an update — wtf happened to the supposedly safe database if it won't survive updates."*

---

## 1. Incident P0-11: learner data did not survive updates

**Status: CONFIRMED → ROOT-CAUSED → FIXED → DRILL-VERIFIED**

### What the learner saw

After an update, the "First Words" achievement (grade your very first review) fired a second time. The app behaved as if their history never existed.

### Forensic findings (from the live DB, 2026-10-20)

| Evidence | Value | Meaning |
|---|---|---|
| `Learner.createdAt` | 2026-10-20T20:31:51Z | the entire DB was recreated that evening |
| ReviewLog / ChatMsg / WritingSub / Exam / Material / GameStat / MistakeFamily / SkillLevel | **0 rows** (reviews: 2, graded after 20:39) | all history before 20:31 is gone |
| `User` row | created 2026-10-20T20:39:28Z | the learner had to re-register from zero |
| `Achievement.first_words.at` | 2026-10-20T20:39:48Z | re-earned on the first review in the fresh DB |
| Workspace file mtimes | `.env`, `prisma/migrations/**` all stamped 20:28:42 | environment rebuilt from the git repo at that moment |

### Root cause

The persistence contract of this environment is: **only git-tracked files survive an update.** `db/custom.db` was deliberately gitignored ("runtime data — not for the public repo"). Every environment rebuild therefore started from a fresh clone: no DB file → schema recreated → zero learner data. The achievement logic itself was never at fault — `evaluateAchievements()` is idempotent against the `Achievement` table; the table had simply been emptied along with everything else.

The October 2026 audit's item 5 ("Safe production DB + migrations: DONE") covered **schema** safety (versioned migrations, no destructive push). It had a blind spot: **the data file was never persisted anywhere**, so "safe migrations" was true and meaningless at the same time.

### What was lost

All learner progress accumulated before 2026-10-20 20:31 UTC: placement level, review history + FSRS memory states, streak, XP/level, achievements, mistake families, tag mastery, chat history, essays, exam results, BYO materials. **Unrecoverable** — no snapshot existed before this incident. The fix below is forward-looking.

### The fix: data-survival layer (all in git)

| Piece | File | Role |
|---|---|---|
| Snapshot core | `scripts/db-snapshot-core.ts` | prunes expired auth noise (active sessions KEPT — the learner stays logged in across updates), then `VACUUM INTO` for a consistent copy safe while the server runs |
| Snapshot side | `scripts/db-snapshot.sh` | content-aware (sha256 skip when unchanged → zero commit churn), gzip (~6 KB today), keeps last 10, lives in `backups/` (tracked) |
| Restore side | `scripts/db-restore.sh` | restore-if-missing only — never touches a live DB |
| Safe migrations | `scripts/db-migrate-safe.sh` | `migrate deploy`; on P3005 (schema without history) baselines existing migrations as applied. **Never** `migrate reset`, **never** `db push --accept-data-loss` |
| Boot guard | `scripts/ensure-server.sh` | restore → migrate-safe → (healthy) snapshot → watchdog self-start |
| Deploy guard | `scripts/deploy.sh` | snapshot + commit before every push — learner history rides every update |
| Watchdog | `scripts/watchdog.sh` | at most once per 24 h: snapshot + commit + push if changed (loss window between deploys ≤ 1 day) |
| Trust beacon | `GET /api/version` | now returns `data: { createdAt, xp, streak, reviews, latestSnapshot }` — if `data.createdAt` ever equals the deploy time, data died and we know instantly |

### Proof (disaster drill, executed 2026-10-20)

1. Snapshot taken → 2. `db/custom.db` deleted (fresh-clone simulation) → 3. `db-restore.sh` + `db-migrate-safe.sh` → P3005 detected → 0001 + 0002 baselined → deploy OK → 4. post-restore DB identical (streak 1, xp 10, 2 reviews, `first_words.at` still 20:39:48 — the achievement does **not** re-fire because its row survived). `tsc --noEmit` clean; server restarted through the full guard path; watchdog running.

---

## 2. Audit checklist tracker (40 entries)

The item-by-item table lives in **ROADMAP-STATUS.md** (kept there so this file stays a decision record). Summary after this incident:

| Section | Done | Partial | Pending |
|---|---|---|---|
| Critical fixes (was 10, +1 new P0-11) | 9 | 1 (provider-failure recovery) | 0 |
| Critical features | 2 | 5 | 3 |
| Polish items | 3 | 7 | 0 |
| Reverse-engineering targets | 1 | 2 | 1 |
| Data stores | 0 | 0 | 3 (all deferred by design) |
| APIs | 1 | 1 | 1 |
| **New: data survives updates (P0-11)** | **1** | 0 | 0 |

Net: **17 done / 16 partial / 8 pending**, with P0-11 closed the same day it was reported.

---

## 3. Stage order after the incident

1. **Stage 01 (stabilize & isolate) — now genuinely stable.** The last unresolved audit P0 (learner data isolation beyond the deployment lock) remains the only structural gap before multi-user; the persistence layer above closes the operational hole that mattered for the single-learner deployment.
2. **Per the audit's guidance: no feature sprawl.** Next score increases come from (a) the single- vs multi-user decision, (b) validated pronunciation assessment (Azure Speech scoring) behind the existing Sound Lab honesty epistemics, (c) authentic exam task structures validated against expert examples, (d) proving learning effectiveness over time (retention, writing, listening, speaking ledgers already collect zero-AI numbers).
3. **Operational doctrine going forward:** every session ends with `bash scripts/deploy.sh` (it now snapshots + commits data before push); after every update, check `GET /api/version` → `data.createdAt` must be UNCHANGED. That single field is the regression tripwire for everything this incident was about.

---

## 4. Verification gates

- Battery: `scripts/test-api-battery.ts` (352 checks) — run against the real stack via the isolated-battery script only (`bash scripts/test-isolated-battery.sh`).
- Data survival: the disaster drill above; re-runnable by hand (snapshot → delete → restore → inspect).
- Freshness: `curl localhost:3000/api/version` vs preview URL — same SHA + same `data.createdAt`.
