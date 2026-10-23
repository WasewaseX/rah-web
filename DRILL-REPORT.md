# Recovery Drill Report — real-environment rebuild, 2026-10-23 (Task 87)

**Why:** the Oct-23 external review made deployment-readiness conditional on exactly
this drill: "Repeat an end-to-end recovery drill against the current deployment …
Repeat the drill after a fresh deployment, not merely against a disposable test
database." Every phase below ran on the REAL deployment and the REAL learner DB —
never a disposable fixture (fixtures are the guard battery's job, 53/53).

**Live learner at drill time:** xp=262, streak=4, 17 reviews, 17 scheduled cards,
3 DailyStat rows, 1 achievement, 14 chats (the learner was actively practicing
DURING the drill — xp moved 220→246→262 across the session).

## Checklist → result

| Review checklist item | Phase | Result |
|---|---|---|
| XP, streaks, achievements, review history survive a rebuild | 1 | **PASS** — live `db/custom.db` deleted; the real boot path restored every row identically; `/api/version` tripwire unchanged (`createdAt=2026-10-20T20:31:51Z`) |
| Scheduled cards + daily statistics recovered when only those rows disappear | 2 | **PASS** — total FSRS loss replayed live: CardState 17 + DailyStat 2 restored insert-only from `db/sync/rah-latest.db`; ReviewLog untouched |
| Legitimate new rows are not overwritten by older snapshots | 2b | **PASS** — post-snapshot survivor rows planted (CardState + DailyStat); partial loss repaired 17+2 while BOTH survivors kept their exact values; second boot = `integrity OK` no-op (idempotent) |
| Snapshots remain private and restore from the offsite vault | 4a/4b/4c | **PASS** — vault repo rejects anonymous `ls-remote` (private), public repo still anonymously readable; pushed snapshot scrubbed (`Session=0`, `LoginCode=0`) and carries the live state; **vault-ONLY restore proven** (no db/sync, no OSS mount — boot recovered the learner from `db/vault-work/rah-web/rah-latest.db`) |
| Drill repeated after a fresh deployment | 3 | **PASS** — `git clone` → `bun install --frozen-lockfile` → real boot sequence → `RESTORE OK` from the surviving OSS mount → fresh server on :3100 served the LIVE learner state (xp=262, streak=4, tripwire intact) |

## What the drill found and fixed (the point of drilling)

1. **Stale Prisma client at boot (Task 87-a, live incident).** This workspace booted
   `next dev` with a generated client from the pre-sync tree (`CardState` without
   `userId`) while the schema carries the isolation shape — every
   `cardState.findMany({where:{userId}})` threw, killing `/api/state` (the eternal
   loading screen) and `/api/coach-agent` (Coach unreachable) — the exact bugs the
   learner reported. Fixed by regenerating + restarting through the real boot path;
   class closed with a stamp-based client-sync guard in `ensure-server.sh`
   (`.rah-schema-stamp`; drift regenerates BEFORE the server accepts requests).
2. **Partial scheduling loss went unrepaired (Task 87-c).** The Task-86 repair
   trigger was coarse (user with ZERO rows): a user left with even ONE CardState row
   got no repair, so 9-of-17-rows-gone sailed through exactly like the pre-Task-86
   total loss did. Trigger extended per-key (every reviewed cardId/day missing from
   CardState/DailyStat is provably lost — both ReviewLog writers upsert CardState in
   the same flow, verified in src). Still strictly INSERT-ONLY: rows restored ONLY
   when a verified snapshot holds them; post-snapshot rows left absent (never
   invented); existing rows never touched. Guard battery 40 → 53/53.
3. **The vault was unreachable from the first boot responder (Task 87-d).**
   `db-guard.sh boot` restore chain omitted the vault clone. Failure path: OSS mount
   unavailable + vault clone present → guard "starts clean" → migrate creates an
   empty schema-only db → restore-if-missing no-ops against the empty file → learner
   data lost with a valid offsite copy sitting in `db/vault-work`. Fix: `GUARD_VAULT`
   added to the boot chain before dated backups.
4. **Restore family ignored GUARD_ROOT (Task 87-d).** `db-restore.sh` and
   `db-migrate-safe.sh` hardcoded `cd /home/z/my-project`, silently operating on the
   canonical workspace even when `GUARD_DB` pointed elsewhere. Both now honor
   `GUARD_ROOT` (default unchanged). This is what made the vault-only drill provable
   at all.

## Honest notes

- The first Phase-2 no-clobber test was mis-designed: total-loss damage deletes the
  planted survivor by definition (as any real total loss would). The corrected
  partial-loss design (2b) is the one that tests the no-clobber property; both runs
  are preserved in `scripts/drill-phase2{,b}.sh`.
- Under total loss, rows created after the newest snapshot are unrecoverable by
  design (insert-only doctrine: never invent schedule state). The per-key repair now
  logs this honestly ("N reviewed key(s) absent from every verified snapshot").
- A total-loss incident on the LIVE db was also replayed once (Phase 2) before the
  repair extension; both live runs ended with the learner fully restored and the app
  healthy, and snapshots were refreshed immediately after each.
- Drill drivers are kept re-runnable: `scripts/recovery-drill.sh` (phase 0),
  `drill-phase1.sh`, `drill-phase2.sh`, `drill-phase2b.sh`, `drill-phase34.sh`.

## Gates after the drill

- Guard battery **53/53** (`bash scripts/test-db-guard.sh`)
- Boot regression check (real learner): request-code → verify → `/api/state` 200
  with payload → coach-agent 200 with a state-aware streamed reply — **ALL PASS**
- Live app serving `47c3939`, learner intact (xp=262, streak=4, 18 total reviews)
- Post-drill snapshots refreshed; vault push verified (scrubbed, private)
