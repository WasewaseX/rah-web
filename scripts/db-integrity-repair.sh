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
# Task 87-c (drill-found gap): the original trigger was coarse - a user with
# even ONE surviving CardState row got NO repair, so a PARTIAL scheduling loss
# (9 of 17 rows gone) sailed through exactly like the Oct-23 total loss did
# before Task 86. The trigger is now per-key: every (userId, cardId) in
# ReviewLog whose CardState row is absent is provably lost (both ReviewLog
# writers upsert CardState in the same flow - verified in src), and every
# reviewed day missing from DailyStat likewise. Still strictly INSERT-ONLY:
# a row is restored ONLY if a verified snapshot holds it; rows written after
# the snapshot have no snapshot row and are left absent (honest loss, never
# invented); existing rows are never touched (no clobber).
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
for table, key in (("CardState", "cardId"), ("DailyStat", "day")):
    sc, lc = cols(snap, table), cols(live, table)
    if not sc or not lc:
        continue
    common = [c for c in sc if c in lc]
    # (userId, key) pairs the review history proves but the live table lacks.
    try:
        affected = live.execute(
            f"SELECT DISTINCT rl.userId, rl.{key} FROM ReviewLog rl "
            f"WHERE NOT EXISTS (SELECT 1 FROM {table} t WHERE t.userId = rl.userId AND t.{key} = rl.{key})"
        ).fetchall()
    except Exception:
        continue
    if not affected:
        continue
    inserted = 0
    absent = 0
    for u, k in affected:
        row = snap.execute(
            f"SELECT {', '.join(common)} FROM {table} WHERE userId=? AND {key}=?", (u, k)
        ).fetchone()
        if row is None:
            # Reviewed after the last verified snapshot (or a no-schedule flow):
            # no verified source holds this row - never invent one.
            absent += 1
            continue
        live.execute(
            f"INSERT OR IGNORE INTO {table} ({', '.join(common)}) VALUES ({', '.join('?' for _ in common)})",
            row,
        )
        inserted += 1
    if inserted:
        msg = f"REPAIRED {table}: restored {inserted} scheduling row(s) (insert-only from {snap_path})"
        if absent:
            msg += f"; {absent} reviewed key(s) absent from every verified snapshot - left absent (post-snapshot work, honest loss)"
        log(msg)
        repaired += inserted
    elif absent:
        log(f"integrity: {absent} reviewed {table} key(s) missing but no verified snapshot holds them - nothing to restore")

live.commit()
live.close()
snap.close()
if repaired == 0:
    log("integrity OK - no scheduling loss detected (or nothing to restore from the snapshot)")
PY
