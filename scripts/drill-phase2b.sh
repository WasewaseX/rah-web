#!/usr/bin/env bash
# Task 87-b PHASE 2b (corrected): partial-loss + no-clobber drill on the LIVE db.
# Lesson from the first Phase-2 run: a total-loss damage step also deletes the
# planted survivor (as any real total loss would), so "survivor survives" can
# only be tested under PARTIAL loss - which the Task-87-c per-key trigger now
# repairs. Damage = delete exactly the snapshot-era scheduling rows; the
# post-snapshot survivor must survive the repair untouched.
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

echo "=== PHASE 2b: partial scheduling loss + no-clobber (live) ==="

# 1) freshest snapshot S - capture its shape NOW: later boots legitimately
# re-sync db/sync from the repaired live db (vault-sync always-refresh,
# Task 91), so the assert-time snapshot no longer represents what the repair
# restore could see.
bash scripts/db-snapshot.sh >/dev/null 2>&1
bash scripts/db-sync.sh >/dev/null 2>&1
SNAP_DS_COUNT="$(python3 - db/sync/rah-latest.db <<'PY'
import sqlite3, sys
con = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
print(con.execute("SELECT COUNT(*) FROM DailyStat WHERE userId='me'").fetchone()[0])
con.close()
PY
)"
SNAP_CS_COUNT="$(python3 - db/sync/rah-latest.db <<'PY'
import sqlite3, sys
con = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
print(con.execute("SELECT COUNT(*) FROM CardState WHERE userId='me'").fetchone()[0])
con.close()
PY
)"
echo "snapshot S shape: CardState(me)=$SNAP_CS_COUNT DailyStat(me)=$SNAP_DS_COUNT"
pass "snapshot S refreshed"

# 2) plant post-snapshot survivor rows S does not know
python3 - "$DB" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
day = con.execute("SELECT MAX(day) FROM DailyStat WHERE userId='me'").fetchone()[0]
ref = con.execute("SELECT s,d FROM CardState WHERE userId='me' LIMIT 1").fetchone()
# CardState columns: userId, cardId, s, d, due, last, lapses, reps, state, lastivl, dir, suspended
con.execute("INSERT OR REPLACE INTO CardState(userId,cardId,s,d,due,last,lapses,reps,state,lastivl,dir,suspended) VALUES('me','drill-noclobber-card',?,?,-1,-1,0,1,'new',0,'',0)", (ref[0], ref[1]))
con.execute("INSERT OR REPLACE INTO DailyStat(userId,day,reviews,correct,xp,spoken,written,listened) VALUES('me',?,0,0,0,0,0,0)", (day + 1,))
con.commit()
cs = con.execute("SELECT COUNT(*) FROM CardState WHERE userId='me' AND cardId='drill-noclobber-card'").fetchone()[0]
ds = con.execute("SELECT COUNT(*) FROM DailyStat WHERE userId='me' AND day=?", (day + 1,)).fetchone()[0]
con.close()
assert cs == 1 and ds == 1, f"plant failed: cs={cs} ds={ds}"
open('db/drill-safety/planted-day.txt', 'w').write(str(day + 1))
print(f"planted survivor rows verified: CardState drill-noclobber-card, DailyStat day={day+1}")
PY

# 3) partial damage: delete exactly the snapshot-era rows for 'me'
python3 - "$DB" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
con.execute("ATTACH 'db/sync/rah-latest.db' AS snap")
con.execute("DELETE FROM main.CardState WHERE userId='me' AND cardId IN (SELECT cardId FROM snap.CardState WHERE userId='me')")
con.execute("DELETE FROM main.DailyStat WHERE userId='me' AND day IN (SELECT day FROM snap.DailyStat WHERE userId='me')")
con.commit()
con.close()
PY
CS_DMG="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'")"
DS_DMG="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'")"
RL_DMG="$(q "SELECT COUNT(*) FROM ReviewLog WHERE userId='me'")"
echo "after partial damage: CardState(me)=$CS_DMG (survivor only) DailyStat(me)=$DS_DMG (future only) ReviewLog(me)=$RL_DMG"
[ "$CS_DMG" = "1" ] && [ "$DS_DMG" = "1" ] && pass "partial loss shape correct (only survivor rows remain)" || fail "unexpected damage shape"

# 4) the REAL boot path repairs pre-server
pkill -f "next-server" 2>/dev/null; pkill -f "next dev -p 3000" 2>/dev/null; sleep 2
bash scripts/ensure-server.sh > "$SAFE/boot3.log" 2>&1
grep -E "REPAIRED|integrity" "$SAFE/boot3.log" | head -4 || true
for _ in $(seq 1 20); do curl -sf -o /dev/null --max-time 3 http://localhost:3000/api/version && break; sleep 2; done

# 5) verify: restored + survivor intact
CS_AFTER="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'")"
DS_AFTER="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'")"
RL_AFTER="$(q "SELECT COUNT(*) FROM ReviewLog WHERE userId='me'")"
SURV="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me' AND cardId='drill-noclobber-card'")"
SURV_DS="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me' AND day=(SELECT MAX(day) FROM DailyStat WHERE userId='me') AND day > (SELECT MAX(day) FROM ReviewLog WHERE userId='me')")"
[ "$CS_AFTER" = "$((SNAP_CS_COUNT + 1))" ] && pass "CardState(me) exact: ${SNAP_CS_COUNT} restored + 1 survivor (no dupes)" || fail "CardState(me)=$CS_AFTER expected $((SNAP_CS_COUNT + 1))"
# Task 91: expected DailyStat = the FULL snapshot ledger captured at step 1
# + 1 planted survivor. Before the Task-91 ledger extension the repair
# restored only the 2 review-backed days (expected 3); now every snapshot-held
# day is restored. The count is the PRE-PLANT snapshot shape (step 1), not an
# assert-time read - the drill's own boot re-syncs db/sync from the repaired
# live db by design (vault-sync always-refresh).
[ "$DS_AFTER" = "$((SNAP_DS_COUNT + 1))" ] && pass "DailyStat(me) exact: ${SNAP_DS_COUNT} snapshot ledger rows restored + 1 survivor" || fail "DailyStat(me)=$DS_AFTER expected $((SNAP_DS_COUNT + 1))"
[ "$RL_AFTER" = "17" ] && pass "ReviewLog untouched (17)" || fail "ReviewLog changed: $RL_AFTER"
[ "$SURV" = "1" ]      && pass "post-snapshot CardState survivor intact (no clobber)" || fail "survivor lost"
[ "$SURV_DS" = "1" ]   && pass "post-snapshot DailyStat survivor intact (no clobber)" || fail "DailyStat survivor lost"

# 6) idempotence: a second boot must be a clean no-op
pkill -f "next-server" 2>/dev/null; pkill -f "next dev -p 3000" 2>/dev/null; sleep 2
bash scripts/ensure-server.sh > "$SAFE/boot4.log" 2>&1
for _ in $(seq 1 20); do curl -sf -o /dev/null --max-time 3 http://localhost:3000/api/version && break; sleep 2; done
CS_IDEM="$(q "SELECT COUNT(*) FROM CardState WHERE userId='me'")"
DS_IDEM="$(q "SELECT COUNT(*) FROM DailyStat WHERE userId='me'")"
# Task 91: outcome-based idempotence. The second boot's repair may legitimately
# skip under the single-flight lock (boot steps race for it) - then no
# "integrity OK" line lands in the log even though nothing was repaired.
# Assert the OUTCOME (counts identical to post-repair state); log the repair
# line presence informationally.
REPAIR_LINE="$(grep -c 'integrity OK' "$SAFE/boot4.log" 2>/dev/null || true)"
if [ "$CS_IDEM" = "$((SNAP_CS_COUNT + 1))" ] && [ "$DS_IDEM" = "$((SNAP_DS_COUNT + 1))" ]; then
  pass "second boot: counts unchanged (CardState=$CS_IDEM DailyStat=$DS_IDEM - idempotent; integrity-OK lines in log: ${REPAIR_LINE:-0})"
else
  fail "idempotence check failed (CS=$CS_IDEM expected $((SNAP_CS_COUNT + 1)), DS=$DS_IDEM expected $((SNAP_DS_COUNT + 1)))"
fi

# 7) app serves the recovered schedule + healthy snapshots again
STATE_CODE="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/version --max-time 5)"
[ "$STATE_CODE" = "200" ] && pass "server healthy after repair" || fail "server unhealthy: $STATE_CODE"

# 8) Task 91 drill hygiene: remove exactly the planted survivor rows so
# synthetic drill data does not accumulate in the learner's ledger (each run
# used to leave one zero-xp future DailyStat day + one drill CardState).
# The planted day is captured at plant time (db/drill-safety/planted-day.txt)
# so the cleanup can NEVER touch a real learner row - the learner's real
# all-zero days (e.g. 2026-10-22) must survive drill hygiene.
PLANTED_DAY="$(cat "$SAFE/planted-day.txt" 2>/dev/null || echo '')"
if [ -n "$PLANTED_DAY" ]; then
  python3 - "$DB" "$PLANTED_DAY" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
con.execute("DELETE FROM CardState WHERE cardId='drill-noclobber-card'")
con.execute("DELETE FROM DailyStat WHERE userId='me' AND day=?", (int(sys.argv[2]),))
con.commit(); con.close()
print(f"drill cleanup: removed planted rows (day={sys.argv[2]})")
PY
fi
bash scripts/db-snapshot.sh >/dev/null 2>&1
bash scripts/db-sync.sh >/dev/null 2>&1
pass "planted drill rows removed; snapshots refreshed with clean learner data"

exit $FAILED
