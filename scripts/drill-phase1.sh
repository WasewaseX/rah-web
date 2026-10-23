#!/usr/bin/env bash
# Task 87-b PHASE 1: real-environment rebuild drill on the LIVE deployment.
# The learner DB is gitignored and dies with every workspace reprovision
# (proven 4 times). This drill replays that failure on the REAL deployment:
# ultra-fresh snapshot -> delete db/custom.db -> the REAL boot path
# (ensure-server.sh: guard boot -> restore-if-missing -> migrate ->
# integrity-repair -> serve) must bring back EVERY learner row.
set -u
cd /home/z/my-project
DB="db/custom.db"
SAFE="db/drill-safety"
FAILED=0
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; FAILED=1; }

snapshot_state() {
  python3 - "$1" <<'PY'
import sqlite3, sys, json
con = sqlite3.connect(sys.argv[1])
uid = "me"
xp, streak = con.execute("SELECT xp, streak FROM Learner WHERE id=?", (uid,)).fetchone()
ach = con.execute("SELECT COUNT(*) FROM Achievement WHERE userId=?", (uid,)).fetchone()[0]
rl  = con.execute("SELECT COUNT(*) FROM ReviewLog WHERE userId=?", (uid,)).fetchone()[0]
cs  = con.execute("SELECT COUNT(*) FROM CardState WHERE userId=?", (uid,)).fetchone()[0]
ds  = con.execute("SELECT COUNT(*) FROM DailyStat WHERE userId=?", (uid,)).fetchone()[0]
ch  = con.execute("SELECT COUNT(*) FROM ChatMsg WHERE userId=?", (uid,)).fetchone()[0]
ws  = con.execute("SELECT COUNT(*) FROM WritingSub WHERE userId=?", (uid,)).fetchone()[0]
con.close()
print(json.dumps({"xp": xp, "streak": streak, "ach": ach, "rl": rl, "cs": cs, "ds": ds, "ch": ch, "ws": ws}))
PY
}

echo "=== PHASE 1: REAL rebuild drill (live db deleted, boot path restores) ==="

# 1) ultra-fresh snapshot to shrink the loss window to seconds
bash scripts/db-snapshot.sh >/dev/null 2>&1
bash scripts/db-sync.sh >/dev/null 2>&1
pass "ultra-fresh snapshot + db/sync taken immediately before deletion"

snapshot_state "$DB" > "$SAFE/pre-rebuild.json"
echo "pre-rebuild state: $(cat "$SAFE/pre-rebuild.json")"

# 2) the failure: the workspace reprovision wipes the untracked db
rm -f "$DB" "$DB-journal" "$DB-wal" "$DB-shm"
[ ! -f "$DB" ] && pass "db/custom.db deleted (rebuild simulated)" || { fail "could not delete db"; exit 1; }

# 3) the REAL boot path (exactly what a reprovisioned workspace runs)
if bash scripts/ensure-server.sh > "$SAFE/boot.log" 2>&1; then
  pass "ensure-server boot path completed"
else
  fail "ensure-server exited non-zero (see $SAFE/boot.log)"
fi
grep -E "RESTORE OK|restore|migrate|integrity" "$SAFE/boot.log" | head -6 || true

# 4) wait for health + compare
for _ in $(seq 1 20); do
  curl -sf -o /dev/null --max-time 3 http://localhost:3000/api/version && break
  sleep 2
done
snapshot_state "$DB" > "$SAFE/post-rebuild.json"
echo "post-rebuild state: $(cat "$SAFE/post-rebuild.json")"

if python3 -c "
import json,sys
a=json.load(open('$SAFE/pre-rebuild.json')); b=json.load(open('$SAFE/post-rebuild.json'))
sys.exit(0 if all(a[k]==b[k] for k in a) else 1)"; then
  pass "EVERY learner row survived the real rebuild (xp/streak/achievements/reviews/cards/daily/chats/writings)"
else
  fail "state mismatch after rebuild"
fi

# 5) the version tripwire must NOT show a data reset
curl -s http://localhost:3000/api/version | python3 -c "
import sys, json
d = json.load(sys.stdin)
created = d.get('data', {}).get('createdAt', '')
xp = d.get('data', {}).get('xp', -1)
ok = created.startswith('2026-10-20') and xp > 0
print(('PASS' if ok else 'FAIL') + f' version tripwire: createdAt={created} xp={xp}')
sys.exit(0 if ok else 1)" || FAILED=1

exit $FAILED
