# PG-DECISION.md — the production database decision brief (2026-10-24, Task 92-bis)

**The one remaining P0 decision:** stay on SQLite (single-learner, registration locked) or
complete the PostgreSQL physical flip (multi-user path). Everything below the decision line is
already built, proven, and drill-hardened; this document exists so the decision itself is
informed, one-click to execute, and reversible. The October 24 review: *"complete the production
database decision if Rah will serve multiple accounts, then rehearse the complete migration and
restore on the actual deployment."*

---

## 1. What is already proven (no further engineering required for either path)

| Proof | Where | Result |
|-------|-------|--------|
| Grade-route transaction shape under concurrency (8 workers, 200 tx, zero lost updates) | Task 74, `scripts/pg-validate.ts` 16/16 | ~341 tx/s on READ COMMITTED; atomic XP increments + upserts hold |
| Offline-replay idempotency on PG (GradeAck gid race: 12 concurrent same-gid creates) | Task 74 | exactly 1 winner, 11 honest P2002s |
| Schema applies cleanly (30 tables / 21 indexes) via `prisma migrate diff` | Tasks 74/89/92 | `prisma/schema.postgres.prisma`, app's SQLite client untouched |
| Live learner data copied SQLite → PG with zero mismatches | Tasks 89/92 (COPY FROM STDIN, epoch-ms adaptation, sequence resets) | 30/30 table counts match, learner checksum identical |
| Real app serves the authenticated learner FROM PostgreSQL | Task 92 (standalone bundle rebuilt with PG client, :3100, state 200 + coach 200) | complete rehearsal on the actual deployment |
| Restore drill on PG (pg_dump / drop / create / pg_restore → verify) | Task 92 | GREEN |
| Flip runbook with drill-found gap fixes (G1 provider switch + client regen + rebuild; G2 one-time PG baseline migration history with SQLite history preserved + full rollback; G3 verify footer-parse fix) | Task 92, `scripts/pg-cutover.sh` | executed end-to-end, workspace rollback verified clean |
| Identity-split class closed before any second account can exist (the coach surface wrote under the legacy id while session writes used the auth id; reconciled 78 rows / 10 collisions, coach now stamps the session user) | Task 92-ter, `02248f0` + merge script re-runnable | per-user keying verified live: zero legacy rows across all user-keyed tables; the October 24 review's Task 92-ter findings |

## 2. The decision, with consequences

**Option A — stay SQLite (single-learner era).** Zero work. The deployment lock stays on, the
data-survival chain (boot restore → snapshots → private vault) keeps running, and every
capability tested in CI keeps working exactly as today. Consequence: registration stays locked;
a second account would share the SQLite-era operational model (WAL mode, single-writer, local FS
snapshots) — workable for one learner, not the launch posture for many.

**Option B — complete the PostgreSQL flip (multi-user path).** One command plus two human
follow-ups. Consequence: registration can then be considered for opening once the post-flip
verification passes; managed backups replace the snapshot chain as the primary safety net (the
vault chain stays as defense-in-depth).

## 3. The flip (Option B), end to end

```bash
# 0. pre-flight (all must be true)
bash scripts/pg-cutover.sh                 # dry-run: prints the plan, touches nothing
#   [ ] a TCP-reachable PostgreSQL 14+ exists and DATABASE_URL can reach it
#   [ ] the freshest restore chain is green: python3 scripts/freshness-check.py
#   [ ] guard battery green on the current tree: bash scripts/test-db-guard.sh   (58/58)

# 1. prove against the real server first (does NOT flip)
bash scripts/pg-cutover.sh --pg-url "postgresql://USER:PASS@HOST:5432/rah"

# 2. flip (guarded; requires an explicit second confirmation)
bash scripts/pg-cutover.sh --flip "postgresql://USER:PASS@HOST:5432/rah"
#    what it does: schema baseline -> live-data COPY -> 30/30 verify ->
#    .env DATABASE_URL swap (timestamped backup) -> provider switch + client
#    regenerate + bundle rebuild (G1) -> one-time PG baseline migration
#    history, SQLite history preserved aside (G2) -> restart + boot
#    regression on the PG-backed server.

# 3. post-flip verification
bash scripts/run-boot-regression-pg.sh     # state 200 + coach 200 on PG
curl -s http://localhost:3000/api/version  # createdAt tripwire unchanged
```

**Rollback (proven in Task 92 on this workspace):** restore the timestamped `.env` backup,
regenerate the SQLite client, rebuild the bundle, restart. The SQLite data file is never
destroyed by the flip — the COPY reads it strictly read-only; the flip only changes which engine
the app boots.

## 4. What stays true either way

Per-user isolation is complete in code and schema (Tasks 63/65/67, isolation battery 47/47 since Task 92-ter's coach-stamp pins);
the deployment lock decision is independent of the storage engine; the privacy doctrine (zero
learner data in the public repo, vault-only offsite copies) is engine-agnostic; and the
`/api/version` `createdAt` tripwire verifies learner-data continuity across any cutover.

## 5. Recommendation

If Rah will serve additional accounts: take Option B, using §3 verbatim, after the GitHub
Support purge lands (priority 1). If Rah remains a single-learner deployment: stay on Option A
with zero regret — the PG path is fully rehearsed and does not rot (the runbook is re-runnable;
`--sandbox` re-proves it on demand without touching production).
