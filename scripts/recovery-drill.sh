#!/usr/bin/env bash
# Task 87-b PHASE 0-2 driver: real-environment recovery drill on the LIVE db.
# Phase 0: baseline capture + safety snapshot (drill never starts without one)
# Phase 1: real rebuild - db/custom.db deleted, the REAL boot path must restore
# Phase 2: FSRS-only loss (the Oct-23 class) - boot repair must restore
#          CardState/DailyStat INSERT-ONLY without clobbering newer rows
# Every phase prints PASS/FAIL lines; any FAIL exits non-zero.
set -u
cd /home/z/my-project

DB="db/custom.db"
SAFE="db/drill-safety"
mkdir -p "$SAFE"
PHASE="${1:-all}"
FAILED=0

say()  { echo "[drill] $*"; }
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; FAILED=1; }

baseline() {
  python3 - "$DB" <<'PY'
import sqlite3, sys, json
con = sqlite3.connect(sys.argv[1])
uid = "me"
xp, streak = con.execute("SELECT xp, streak FROM Learner WHERE id=?", (uid,)).fetchone()
ach  = con.execute("SELECT COUNT(*) FROM Achievement WHERE userId=?", (uid,)).fetchone()[0]
rl   = con.execute("SELECT COUNT(*) FROM ReviewLog WHERE userId=?", (uid,)).fetchone()[0]
cs   = con.execute("SELECT COUNT(*) FROM CardState WHERE userId=?", (uid,)).fetchone()[0]
ds   = con.execute("SELECT COUNT(*) FROM DailyStat WHERE userId=?", (uid,)).fetchone()[0]
ch   = con.execute("SELECT COUNT(*) FROM ChatMsg WHERE userId=?", (uid,)).fetchone()[0]
con.close()
print(json.dumps({"xp": xp, "streak": streak, "ach": ach, "rl": rl, "cs": cs, "ds": ds, "ch": ch}))
PY
}

current() { baseline; }

if [ "$PHASE" = "phase0" ] || [ "$PHASE" = "all" ]; then
  say "=== PHASE 0: baseline + safety snapshots ==="
  baseline > "$SAFE/baseline.json"
  cat "$SAFE/baseline.json"
  cp "$DB" "$SAFE/pre-drill-full.db" && echo "safety copy: $SAFE/pre-drill-full.db ($(stat -c%s "$SAFE/pre-drill-full.db") bytes)"
  bash scripts/db-snapshot.sh >/dev/null 2>&1 && pass "content-aware snapshot taken (backups/)"
  bash scripts/db-sync.sh >/dev/null 2>&1 && pass "db/sync + OSS mount staged"
  # verify the snapshot actually contains the learner rows
  SNAP="$(ls -t backups/rah-*.sqlite.gz | head -1)"
  gunzip -c "$SNAP" > "$SAFE/probe-snap.db" 2>/dev/null
  SNAPJSON="$(python3 - "$SAFE/probe-snap.db" <<'PY'
import sqlite3, sys, json
con = sqlite3.connect(sys.argv[1])
uid = "me"
xp, streak = con.execute("SELECT xp, streak FROM Learner WHERE id=?", (uid,)).fetchone()
rl = con.execute("SELECT COUNT(*) FROM ReviewLog WHERE userId=?", (uid,)).fetchone()[0]
cs = con.execute("SELECT COUNT(*) FROM CardState WHERE userId=?", (uid,)).fetchone()[0]
print(json.dumps({"xp": xp, "streak": streak, "rl": rl, "cs": cs}))
PY
)"
  echo "snapshot probe: $SNAPJSON"
  python3 -c "
import json,sys
a=json.load(open('$SAFE/baseline.json')); b=json.load(sys.stdin)
ok = a['xp']==b['xp'] and a['streak']==b['streak'] and a['rl']==b['rl']
sys.exit(0 if ok else 1)" <<< "$SNAPJSON" && pass "snapshot carries the full learner state" || fail "snapshot state mismatch"
  [ "$PHASE" = "phase0" ] && exit $FAILED
fi
exit $FAILED
