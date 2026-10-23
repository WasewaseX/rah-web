#!/usr/bin/env bash
# Task 90 (DB round 2): durable SQLite maintenance. The Task-89 indexes are
# structural, but the query planner was running on heuristics - sqlite_stat1
# did not even EXIST on the live db (ANALYZE never ran). stat1 data is what
# lets the planner pick the composite indexes for skewed distributions.
#
# What this does (all durable / in-file effects):
#   1. PRAGMA optimize  - SQLite's self-tuner; creates/updates stat1 where
#      analysis would help (recommended: run periodically or at close).
#   2. ANALYZE          - explicit full stat1 refresh (cheap at learner scale:
#      the whole db is <1MB).
#   3. wal_checkpoint(TRUNCATE) - bounds the WAL file on disk after heavy days
#      (autocheckpoint handles in-flight pages; the truncate reclaims the file).
#
# Honest scope note: cache_size/mmap_size/synchronous are PER-CONNECTION
# PRAGMAs - Prisma's pool does not expose a per-connection hook, so they cannot
# be set here. At learner scale (db < 1MB, single writer) the defaults are
# adequate; the real wins remain the 0010 indexes + stat1 data.
# GUARD_* convention (Task 87-d): GUARD_ROOT pins the canonical tree even when
# cwd is the standalone dir. Single-flight; never throws on the caller.
set -u
GUARD_ROOT="${GUARD_ROOT:-/home/z/my-project}"
GUARD_DB="${GUARD_DB:-$GUARD_ROOT/db/custom.db}"
LOG="${GUARD_LOG:-$GUARD_ROOT/db/optimize.log}"

log() { echo "[$(date -Is)] $*" >> "$LOG"; }

[ -f "$GUARD_DB" ] || { log "ABORT: db missing at $GUARD_DB"; exit 0; }

# Single-flight via flock on the log sidecar (releases on exit).
exec 9>>"$GUARD_ROOT/db/.optimize.lock"
flock -n 9 || { log "skip: another optimize run holds the lock"; exit 0; }

OUT="$(python3 - "$GUARD_DB" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1], timeout=30)
try:
    before = con.execute("SELECT count(*) FROM sqlite_stat1").fetchone()[0]
except Exception:
    before = 0
con.execute("PRAGMA optimize")
con.execute("ANALYZE")
con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
after = con.execute("SELECT count(*) FROM sqlite_stat1").fetchone()[0]
con.commit()
# Sanity: the planner must now see stat1 rows for the hot tables.
hot = {r[0]: r[1] for r in con.execute(
    "SELECT tbl, idx FROM sqlite_stat1 WHERE tbl IN ('ReviewLog','CardState','ChatMsg','Learner')")}
con.close()
print(f"stat1 rows {before} -> {after}; hot coverage: {hot}")
PY
)" || { log "FAILED: $OUT"; exit 0; }

log "OK: $OUT"
echo "$OUT"
