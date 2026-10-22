#!/usr/bin/env bash
# Rah data integrity repair - the "scheduling loss" class (Task 86).
#
# Incident (2026-10-23): the live DB lost the learner's CardState(me) rows
# (FSRS schedule) and DailyStat(me) while ReviewLog(me)/ChatMsg(me) survived,
# and gained battery-user junk rows. The boot path restored only-if-MISSING,
# so a live-but-DAMAGED DB sailed through every guard: the schema canary
# checks SHAPE, the fresh/used heuristic sees ReviewLog>0 and says "real
# usage". The learner kept their history badge but their whole review
# schedule was gone (seen 17 -> 0).
#
# This repair closes that class: when a user's ReviewLog says they reviewed
# N cards but their CardState holds nothing, the schedule is provably lost -
# and the verified snapshot chain (the same sources db-restore.sh trusts)
# is the repair source. The restore is INSERT-ONLY (missing PKs), never a
# clobber: rows written after the snapshot survive.
#
# Boot wiring: ensure-server.sh runs it AFTER db-restore + migrations and
# BEFORE the server accepts writes. The watchdog's daily tick re-runs it.
# It never blocks boot: exit 0 on every path.
#
# Paths are env-overridable (same GUARD_* convention as db-guard.sh) so the
# battery runs it against throwaway fixtures.

set -u

GUARD_ROOT="${GUARD_ROOT:-/home/z/my-project}"
GUARD_DB="${GUARD_DB:-$GUARD_ROOT/db/custom.db}"
GUARD_SYNC="${GUARD_SYNC:-$GUARD_ROOT/db/sync/rah-latest.db}"
GUARD_VAULT="${GUARD_VAULT:-$GUARD_ROOT/db/vault-work/rah-web/rah-latest.db}"
GUARD_LOCAL="${GUARD_LOCAL:-$GUARD_ROOT/db/backups}"
GUARD_OFFSITE="${GUARD_OFFSITE:-$GUARD_ROOT/upload/rah-backups}"
GUARD_LOG="${GUARD_LOG:-$GUARD_ROOT/db/boot-guard.log}"

mkdir -p "$(dirname "$GUARD_DB")" "$(dirname "$GUARD_LOG")"

# Single-flight with the guard family (boot + daily tick can race).
exec 9>"$(dirname "$GUARD_DB")/.guard.lock"
flock -n 9 || exit 0

log() { echo "[db-integrity] $(date -Is) $*" >> "$GUARD_LOG"; echo "[db-integrity] $*"; }

# A candidate source must open as SQLite and hold the Learner table.
probe() {
  local f="$1"
  [ -f "$f" ] && [ -s "$f" ] || return 1
  python3 - "$f" <<'PY' 2>/dev/null
import sqlite3, sys
c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
c.execute('SELECT COUNT(*) FROM "Learner"').fetchone()
c.close()
PY
}

# Newest verified offsite/local custom-*.db snapshot.
newest_custom() {
  local dir f
  for dir in "$GUARD_OFFSITE" "$GUARD_LOCAL"; do
    while IFS= read -r f; do
      if probe "$f"; then echo "$f"; return 0; fi
    done < <(ls -1t "$dir"/custom-*.db 2>/dev/null)
  done
  return 1
}

[ -f "$GUARD_DB" ] || { log "live DB missing - db-restore.sh owns that path, nothing to repair"; exit 0; }

# Pick the repair source BEFORE touching anything: db/sync (freshest local),
# vault clone, newest verified custom-*.db snapshot. Gunzip fallback handled
# by db-restore's chain; here we accept what db-restore already laid down.
SRC=""
for cand in "$GUARD_SYNC" "$GUARD_VAULT"; do
  if probe "$cand"; then SRC="$cand"; break; fi
done
if [ -z "$SRC" ]; then SRC="$(newest_custom || true)"; fi
if [ -z "$SRC" ]; then
  log "no verified repair source available (sync/vault/custom-*.db) - cannot check scheduling loss against a snapshot"
  exit 0
fi

# The repair itself, insert-only, logged.
python3 - "$GUARD_DB" "$SRC" "$GUARD_LOG" <<'PY'
import sqlite3, sys, datetime

live_path, snap_path, log_path = sys.argv[1], sys.argv[2], sys.argv[3]

def log(msg):
    line = f"[db-integrity] {datetime.datetime.now().isoformat()} {msg}"
    print(line)
    with open(log_path, "a") as fh:
        fh.write(line + "\n")

live = sqlite3.connect(live_path)
snap = sqlite3.connect(f"file:{snap_path}?mode=ro", uri=True)

def cols(c, t):
    return [r[1] for r in c.execute(f"PRAGMA table_info({t})")]

repaired = 0
for table, pk in (("CardState", ("userId", "cardId")), ("DailyStat", ("userId", "day"))):
    sc, lc = cols(snap, table), cols(live, table)
    if not sc or not lc:
        continue
    common = [c for c in sc if c in lc]
    # Users with review history in the live DB but NO rows in this table.
    affected = []
    try:
        affected = [r[0] for r in live.execute(
            f"SELECT DISTINCT userId FROM ReviewLog WHERE userId NOT IN (SELECT DISTINCT userId FROM {table})")]
    except Exception:
        pass
    if not affected:
        continue
    for u in affected:
        missing = []
        for row in snap.execute(f"SELECT {', '.join(common)} FROM {table} WHERE userId=?", (u,)):
            where = " AND ".join(f"{k}=?" for k in pk)
            vals = tuple(row[common.index(k)] for k in pk)
            if not live.execute(f"SELECT 1 FROM {table} WHERE {where}", vals).fetchone():
                missing.append(row)
        if not missing:
            continue
        ph = ", ".join("?" for _ in common)
        live.executemany(f"INSERT INTO {table} ({', '.join(common)}) VALUES ({ph})", missing)
        log(f"REPAIRED {table} for user '{u}': restored {len(missing)} scheduling rows (insert-only) from {snap_path}")
        repaired += len(missing)

live.commit()
live.close()
snap.close()
if repaired == 0:
    log("integrity OK - no scheduling loss detected (or nothing to restore from the snapshot)")
PY
