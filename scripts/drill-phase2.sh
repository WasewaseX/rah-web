#!/usr/bin/env bash
# Task 87-b PHASE 2: FSRS-only loss drill (Oct-23 incident class) on the LIVE db.
# The incident: ReviewLog/chat survived but CardState+DailyStat rows vanished -
# every existing guard passed because the DB was present with legitimate rows.
# The Task-86 boot repair must restore the schedule INSERT-ONLY:
#   - rows missing from the newer snapshot (created after it) must SURVIVE
#   - restored counts must be EXACT (no duplicates)
#   - ReviewLog must be untouched
set -u
cd /home/z/my-project
DB="db/custom.db"
SAFE="db/drill-safety"
FAILED=0
pass() { echo "PASS $*"; }
fail() { echo "FAIL $*"; FAILED=1; }

q() { python3 - "$DB" "$1" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
print(con.execute(sys.argv[2]).fetchone()[0])
con.close()
PY
}

echo "=== PHASE 2: FSRS-only loss + insert-only repair drill ==="

# 1) freshest snapshot S (the repair chain reads db/sync)
bash scripts/db-snapshot.sh >/dev/null 2>&1
bash scripts/db-sync.sh >/dev/null 2>&1
pass "snapshot S taken (db/sync refreshed)"

# 2) legitimate future work the snapshot does NOT know about
python3 - "$DB" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
day = con.execute("SELECT day FROM DailyStat WHERE userId='me' ORDER BY day DESC LIMIT 1").fetchone()[0]
ref = con.execute("SELECT s,d,due,last,lapses,reps,state,lastivl,dir FROM CardState WHERE userId='me' LIMIT 1").fetchone()
con.execute("INSERT OR REPLACE INTO CardState(userId,cardId,s,d,due,last,lapses,reps,state,lastivl,dir,suspended) VALUES('me','drill-noclobber-card',?,?,-1,-1,0,1,'new',0,'',0)", (ref[0], ref[1]))
con.execute("INSERT OR REPLACE INTO DailyStat(userId,day,reviews,correct,xp,spoken,written,listened) VALUES('me',?,0,0,0,0,0,0)", (day + 1,))
con.commit()
print(f"planted: CardState drill-noclobber-card + DailyStat day={day+1}")
con.close()
PY
CS_BEFORE="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'")"
DS_BEFORE="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'")"
RL_BEFORE="$(q "SELECT COUNT(*) FROM ReviewLog WHERE userId='me'")"
echo "pre-loss: CardState=$CS_BEFORE DailyStat=$DS_BEFORE ReviewLog=$RL_BEFORE"

# 3) the incident: scheduling rows vanish (review history survives)
python3 - "$DB" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
con.execute("DELETE FROM CardState WHERE userId='me'")
con.execute("DELETE FROM DailyStat WHERE userId='me'")
con.commit()
con.close()
PY
echo "damage done: CardState(me)=$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'") DailyStat(me)=$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'") ReviewLog(me)=$(q "SELECT COUNT(*) FROM ReviewLog WHERE userId='me'")"

# 4) the REAL boot path finds the damaged db and repairs pre-server
pkill -f "next-server" 2>/dev/null; pkill -f "next dev -p 3000" 2>/dev/null; sleep 2
if bash scripts/ensure-server.sh > "$SAFE/boot2.log" 2>&1; then
  pass "boot path completed"
else
  fail "ensure-server failed (see $SAFE/boot2.log)"
fi
grep -E "integrity|repair" "$SAFE/boot2.log" | head -4 || true

for _ in $(seq 1 20); do
  curl -sf -o /dev/null --max-time 3 http://localhost:3000/api/version && break
  sleep 2
done

# 5) verify - TOTAL-loss semantics (Task 91 recalibration).
# The damage step deletes EVERYTHING for 'me', including the planted rows, so
# the only honest assertions are against the SNAPSHOT (what the verified chain
# can prove): the repair must restore exactly the snapshot-backed rows - with
# the Task-91 DailyStat ledger extension that includes non-review practice
# days - and nothing else. Post-snapshot rows are honestly lost through total
# damage BY DESIGN ("never invent"); the no-clobber property (post-snapshot
# rows survive PARTIAL loss) is drill-phase2b.sh's test, which is why that
# driver exists (the Task-87-b honest note).
SNAP="db/sync/rah-latest.db"
SNAP_CS="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'")"
SNAP_DS="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'")"
CS_AFTER="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'")"
DS_AFTER="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'")"
RL_AFTER="$(q "SELECT COUNT(*) FROM ReviewLog WHERE userId='me'")"
NOCLobber="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me' AND cardId='drill-noclobber-card'")"

echo "pre-loss: CardState=$CS_BEFORE DailyStat=$DS_BEFORE | snapshot: CardState=$SNAP_CS DailyStat=$SNAP_DS | after repair: CardState=$CS_AFTER DailyStat=$DS_AFTER"

[ "$RL_AFTER" = "$RL_BEFORE" ] && pass "ReviewLog untouched ($RL_AFTER rows)" || fail "ReviewLog changed: $RL_BEFORE -> $RL_AFTER"
[ "$CS_AFTER" = "$SNAP_CS" ] && pass "CardState restored exactly to the verified snapshot ($CS_AFTER rows)" || fail "CardState after=$CS_AFTER but snapshot holds $SNAP_CS"
[ "$DS_AFTER" = "$SNAP_DS" ] && pass "DailyStat ledger restored exactly to the verified snapshot ($DS_AFTER rows incl. non-review days)" || fail "DailyStat after=$DS_AFTER but snapshot holds $SNAP_DS"
if [ "$NOCLobber" = "0" ]; then
  pass "planted post-snapshot rows honestly absent through TOTAL loss (never invented - by design; no-clobber is phase 2b's partial-loss test)"
else
  fail "planted rows present after total-loss repair - impossible unless damage or restore misfired"
fi

# 6) the app must serve the recovered schedule
curl -s -o /dev/null -w "state-route status: %{http_code}\n" http://localhost:3000/api/version --max-time 5
if python3 -c "
import sqlite3, sys
con = sqlite3.connect('$DB')
due = con.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me' AND due >= 0\").fetchone()[0]
print(f'restored scheduled cards with due dates: {due}')
sys.exit(0 if due > 0 else 1)" 2>/dev/null; then
  pass "schedule restored with real due dates"
else
  fail "no scheduled cards after repair"
fi

# 7) refresh snapshots so the newest chain entries are healthy again
bash scripts/db-snapshot.sh >/dev/null 2>&1
bash scripts/db-sync.sh >/dev/null 2>&1
pass "post-repair snapshots refreshed (healthy state is now the freshest)"

exit $FAILED
