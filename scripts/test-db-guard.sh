#!/usr/bin/env bash
# Regression battery for scripts/db-guard.sh - the 2026-10-21 data-loss
# incident ("First Words" achievement re-fired because a workspace-rebuilding
# update erased the untracked custom.db and db:push recreated it EMPTY).
#
# Runs the guard against THROWAWAY dirs only (GUARD_* overrides). The real
# learner DB at db/custom.db is never opened by this test.
#
# Pins:
#  1. fresh DB + no backups      -> clean start, no restore, no snapshot
#  2. established DB + boot      -> snapshot to BOTH local and offsite
#  3. DB wiped after established -> boot restores newest verified backup
#  4. corrupt newest backup      -> skipped by the integrity probe, older
#                                   verified backup restored instead
#  5. rotation                   -> keep exactly GUARD_KEEP snapshots
#  6. daily stamp                -> second same-day daily run is a no-op
#  7. established DB at boot     -> snapshotted, NEVER clobbered by a restore
#  8. torn copy                  -> garbage file that fails the probe is
#                                   never restored

set -u
GUARD="$(cd "$(dirname "$0")" && pwd)/db-guard.sh"
PASS=0; FAIL=0
note() { echo "  $*"; }
ok()   { PASS=$((PASS+1)); note "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); note "FAIL: $1"; }
assert() { # assert <desc> <cmd...>
  local d="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi
}
refute() {
  local d="$1"; shift
  if "$@" >/dev/null 2>&1; then bad "$d"; else ok "$d"; fi
}

newenv() {
  T="$(mktemp -d)"
  mkdir -p "$T/db" "$T/db/backups" "$T/upload/rah-backups"
  GUARD_ROOT="$T" GUARD_DB="$T/db/custom.db" GUARD_LOCAL="$T/db/backups" \
  GUARD_OFFSITE="$T/upload/rah-backups" GUARD_LOG="$T/db/guard.log" \
  GUARD_KEEP="${GUARD_KEEP_TEST:-14}"
}
run() { GUARD_ROOT="$T" GUARD_DB="$T/db/custom.db" GUARD_LOCAL="$T/db/backups" GUARD_OFFSITE="$T/upload/rah-backups" GUARD_LOG="$T/db/guard.log" GUARD_KEEP="${GUARD_KEEP_TEST:-14}" bash "$GUARD" "$1" >>"$T/db/guard.log" 2>&1; }

# Fixture: an ESTABLISHED db (real usage signals the guard must respect).
established_db() { # established_db <path>
  python3 - "$1" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.executescript('''
CREATE TABLE "Learner" (id TEXT PRIMARY KEY, xp INTEGER, streak INTEGER, lastActiveDay INTEGER, gems INTEGER, sp INTEGER);
CREATE TABLE "ReviewLog" (id INTEGER PRIMARY KEY, grade INTEGER);
CREATE TABLE "CardState" (id INTEGER PRIMARY KEY, due INTEGER);
''')
c.execute('INSERT INTO Learner VALUES ("me", 4210, 12, 20746, 88, 3)')
c.executemany('INSERT INTO ReviewLog (grade) VALUES (?)', [(g,) for g in (1,2,3,4)])
c.execute('INSERT INTO CardState (due) VALUES (20747)')
c.commit(); c.close()
PY
}
# Fixture: a FRESH db (bare lazily-created learner row, zero history).
fresh_db() {
  python3 - "$1" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.executescript('''
CREATE TABLE "Learner" (id TEXT PRIMARY KEY, xp INTEGER, streak INTEGER, lastActiveDay INTEGER, gems INTEGER, sp INTEGER);
CREATE TABLE "ReviewLog" (id INTEGER PRIMARY KEY, grade INTEGER);
''')
c.execute('INSERT INTO Learner VALUES ("me", 0, 0, -1, 0, 0)')
c.commit(); c.close()
PY
}

echo "== db-guard regression battery =="

# --- 1. fresh DB + no backups: clean start, nothing invented -------------
newenv
fresh_db "$T/db/custom.db"
run boot
assert "1a fresh+no-backup: DB untouched"      test -f "$T/db/custom.db"
refute "1b fresh+no-backup: no snapshot taken" test -f "$T/upload/rah-backups"/custom-*.db
refute "1c fresh+no-backup: no restore fires"  bash -c "grep -q 'RESTORE OK' '$T/db/guard.log'"
ok "1 fresh start behavior"

# --- 2. established DB + boot: snapshot to BOTH places -------------------
newenv
established_db "$T/db/custom.db"
run boot
assert "2a local snapshot exists"  ls "$T/db/backups"/custom-*.db >/dev/null
assert "2b offsite snapshot exists" ls "$T/upload/rah-backups"/custom-*.db >/dev/null
refute "2c established DB never restored over" bash -c "grep -q 'RESTORE OK' '$T/db/guard.log'"
ok "2 boot snapshots established DB"

# --- 3. THE INCIDENT: DB wiped after establishment ------------------------
newenv
established_db "$T/db/custom.db"
run boot                                   # snapshot exists (offsite + local)
rm -f "$T/db/custom.db"                    # the update erased it
run boot                                   # next boot must bring it back
assert "3a DB restored from backup"        test -f "$T/db/custom.db"
assert "3b learner data intact"            python3 -c "import sqlite3,sys; c=sqlite3.connect('$T/db/custom.db'); assert c.execute('SELECT xp FROM Learner').fetchone()[0]==4210; assert c.execute('SELECT COUNT(*) FROM ReviewLog').fetchone()[0]==4"
assert "3c restore logged loudly"          bash -c "grep -q 'RESTORE OK' '$T/db/guard.log'"
# and the trophy can never re-fire on restored history
assert "3d achievements/history present so first_words cannot re-award" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute('SELECT COUNT(*) FROM ReviewLog').fetchone()[0]==4"
ok "3 wiped DB restored at boot (the incident)"

# --- 4. corrupt newest backup is skipped ----------------------------------
newenv
established_db "$T/db/custom.db"
run boot
NEWEST="$(ls -1t "$T/upload/rah-backups"/custom-*.db | head -1)"
python3 -c "open('$NEWEST','wb').write(b'not a database at all')"   # corrupt the newest
rm -f "$T/db/custom.db"
run boot
assert "4a fell back to older verified backup" test -f "$T/db/custom.db"
assert "4b data intact from older snapshot"    python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute('SELECT xp FROM Learner').fetchone()[0]==4210"
assert "4c corruption warned loudly"           bash -c "grep -q 'failed integrity probe' '$T/db/guard.log'"
ok "4 corrupt newest backup skipped"

# --- 5. rotation keeps exactly GUARD_KEEP ---------------------------------
GUARD_KEEP_TEST=3
newenv
established_db "$T/db/custom.db"
for i in 1 2 3 4 5; do cp "$T/db/custom.db" "$T/upload/rah-backups/custom-2026010$i-000000-daily.db"; cp "$T/db/custom.db" "$T/db/backups/custom-2026010$i-000000-daily.db"; sleep 0.05; done
run daily
assert "5a offsite rotated to 3" test "$(ls -1 "$T/upload/rah-backups"/custom-*.db | wc -l)" -eq 3
assert "5b local rotated to 3"   test "$(ls -1 "$T/db/backups"/custom-*.db | wc -l)" -eq 3
GUARD_KEEP_TEST=14
ok "5 rotation keeps GUARD_KEEP"

# --- 6. daily stamp: same-day re-run is a no-op ----------------------------
newenv
established_db "$T/db/custom.db"
run daily
N1="$(ls -1 "$T/upload/rah-backups"/custom-*.db 2>/dev/null | wc -l)"
run daily
N2="$(ls -1 "$T/upload/rah-backups"/custom-*.db 2>/dev/null | wc -l)"
assert "6a first daily run snapshots" test "$N1" -eq 1
assert "6b same-day re-run deduped"   test "$N2" -eq 1
ok "6 daily stamp dedupes"

# --- 7. established DB is never clobbered by a restore ---------------------
newenv
established_db "$T/db/custom.db"
run boot
python3 - "$T/db/custom.db" <<'PY'   # learner keeps working AFTER the snapshot
import sqlite3, sys
c = sqlite3.connect(sys.argv[1]); c.execute('UPDATE Learner SET xp=9999 WHERE id="me"'); c.commit(); c.close()
PY
run boot
assert "7a newer live state survives" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute('SELECT xp FROM Learner').fetchone()[0]==9999"
ok "7 restore never overwrites a used DB"

# --- 8. torn copy (garbage that passes ls -t but fails probe) --------------
newenv
established_db "$T/db/custom.db"
cp "$T/db/custom.db" "$T/upload/rah-backups/custom-20260101-000000-boot.db"
head -c 4096 /dev/urandom > "$T/upload/rah-backups/custom-20260102-000000-daily.db"  # newest = garbage
rm -f "$T/db/custom.db"
run boot
assert "8a garbage newest skipped, older restored" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute('SELECT xp FROM Learner').fetchone()[0]==4210"
ok "8 probe never restores a torn file"

# ===========================================================================
# Integrity repair (Task 86): the 2026-10-23 scheduling-loss incident.
# A live-but-damaged DB (ReviewLog present, CardState gone) passes
# restore-if-missing AND the fresh/used heuristic. The repair restores the
# FSRS schedule INSERT-ONLY from the verified snapshot chain.
# ===========================================================================
REPAIR="$(cd "$(dirname "$0")" && pwd)/db-integrity-repair.sh"
runrepair() {
  GUARD_ROOT="$T" GUARD_DB="$T/db/custom.db" GUARD_SYNC="$T/db/sync/rah-latest.db" \
  GUARD_VAULT="$T/db/vault-work/rah-web/rah-latest.db" GUARD_LOCAL="$T/db/backups" \
  GUARD_OFFSITE="$T/upload/rah-backups" GUARD_LOG="$T/db/guard.log" bash "$REPAIR" >>"$T/db/guard.log" 2>&1
}

# Real-shape fixture: review history present, scheduling rows GONE.
damaged_db() { # damaged_db <path>
  python3 - "$1" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.executescript('''
CREATE TABLE "Learner" (id TEXT PRIMARY KEY, xp INTEGER, streak INTEGER, lastActiveDay INTEGER, gems INTEGER, sp INTEGER);
CREATE TABLE "ReviewLog" (id INTEGER PRIMARY KEY, userId TEXT, cardId TEXT, grade INTEGER, day INTEGER);
CREATE TABLE "CardState" (userId TEXT, cardId TEXT, due INTEGER, reps INTEGER, PRIMARY KEY (userId, cardId));
CREATE TABLE "DailyStat" (userId TEXT, day INTEGER, reviews INTEGER, PRIMARY KEY (userId, day));
''')
c.execute('INSERT INTO Learner VALUES ("me", 220, 2, 20747, 70, 0)')
c.executemany('INSERT INTO ReviewLog (userId, cardId, grade, day) VALUES (?,?,?,?)',
              [("me", "phr080", 2, 20746), ("me", "phr086", 3, 20746), ("me", "awl114", 3, 20747)])
c.commit(); c.close()
PY
}

# Snapshot fixture: the schedule the live DB lost (+ DailyStat).
snapshot_db() { # snapshot_db <path>
  mkdir -p "$(dirname "$1")"
  python3 - "$1" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.executescript('''
CREATE TABLE "Learner" (id TEXT PRIMARY KEY, xp INTEGER, streak INTEGER, lastActiveDay INTEGER, gems INTEGER, sp INTEGER);
CREATE TABLE "ReviewLog" (id INTEGER PRIMARY KEY, userId TEXT, cardId TEXT, grade INTEGER, day INTEGER);
CREATE TABLE "CardState" (userId TEXT, cardId TEXT, due INTEGER, reps INTEGER, PRIMARY KEY (userId, cardId));
CREATE TABLE "DailyStat" (userId TEXT, day INTEGER, reviews INTEGER, PRIMARY KEY (userId, day));
''')
c.execute('INSERT INTO Learner VALUES ("me", 210, 2, 20746, 70, 0)')
c.executemany('INSERT INTO CardState VALUES (?,?,?,?)',
              [("me", "phr080", 20749, 1), ("me", "phr086", 20750, 1), ("me", "awl114", 20749, 1)])
c.execute('INSERT INTO DailyStat VALUES ("me", 20746, 2)')
c.commit(); c.close()
PY
}

# --- 9. scheduling loss is repaired insert-only ----------------------------
newenv
damaged_db "$T/db/custom.db"
snapshot_db "$T/db/sync/rah-latest.db"
runrepair
assert "9a lost CardState rows restored" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me'\").fetchone()[0]==3"
assert "9b lost DailyStat restored"      python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM DailyStat WHERE userId='me'\").fetchone()[0]==1"
assert "9c ReviewLog untouched"          python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM ReviewLog WHERE userId='me'\").fetchone()[0]==3"
assert "9d schedule values from snapshot" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT due FROM CardState WHERE cardId='phr080'\").fetchone()[0]==20749"
ok "9 scheduling-loss repair restores the FSRS schedule"

# --- 10. partial loss: missing rows restored, existing rows never clobbered -
# Task 87-c: the per-key trigger fires even when ONE row survived - the two
# lost rows come back from the snapshot while the newer live value wins.
newenv
damaged_db "$T/db/custom.db"
python3 - "$T/db/custom.db" <<'PY'   # live DB kept ONE row - with a NEWER due than the snapshot's
import sqlite3, sys
c = sqlite3.connect(sys.argv[1]); c.execute('INSERT INTO CardState VALUES ("me","phr080",20751,2)'); c.commit(); c.close()
PY
snapshot_db "$T/db/sync/rah-latest.db"
runrepair
assert "10a missing rows restored despite one survivor" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me'\").fetchone()[0]==3"
assert "10b live value wins (no clobber)" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT due FROM CardState WHERE cardId='phr080'\").fetchone()[0]==20751"
assert "10c restored rows carry snapshot values" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT due FROM CardState WHERE cardId='phr086'\").fetchone()[0]==20750"
ok "10 repair restores partial loss, never clobbers an existing row"

# --- 11. post-snapshot learner progress survives ----------------------------
newenv
damaged_db "$T/db/custom.db"
python3 - "$T/db/custom.db" <<'PY'   # learner reviewed a NEW card after the snapshot was taken
import sqlite3, sys
c = sqlite3.connect(sys.argv[1]); c.execute('INSERT INTO ReviewLog (userId, cardId, grade, day) VALUES ("me","new001",3,20749)'); c.commit(); c.close()
PY
snapshot_db "$T/db/sync/rah-latest.db"
runrepair
assert "11a newer history kept" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM ReviewLog\").fetchone()[0]==4"
assert "11b schedule still restored" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me'\").fetchone()[0]==3"
ok "11 insert-only: post-snapshot progress survives the repair"

# --- 12. no verified source -> graceful no-op -------------------------------
newenv
damaged_db "$T/db/custom.db"
runrepair
assert "12a no source, DB untouched" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM ReviewLog\").fetchone()[0]==3 and c.execute(\"SELECT COUNT(*) FROM CardState\").fetchone()[0]==0"
ok "12 missing source never blocks boot"

# --- 13. partial loss with post-snapshot work: restore proven rows only -----
newenv
damaged_db "$T/db/custom.db"
python3 - "$T/db/custom.db" <<'PY'   # reviewed a NEW card post-snapshot, then lost TWO of three schedule rows
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.execute('INSERT INTO ReviewLog (userId, cardId, grade, day) VALUES ("me","new001",3,20749)')
c.execute('DELETE FROM CardState WHERE cardId IN ("phr086","awl114")')
c.commit(); c.close()
PY
snapshot_db "$T/db/sync/rah-latest.db"
runrepair
assert "13a snapshot-proven rows restored" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me'\").fetchone()[0]==3"
assert "13b no invented schedule for the post-snapshot card" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE cardId='new001'\").fetchone()[0]==0"
assert "13c history untouched" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM ReviewLog\").fetchone()[0]==4"
ok "13 partial loss repairs exactly what the snapshot proves"

# --- 14. DailyStat partial loss: missing day restored, existing day kept ----
newenv
damaged_db "$T/db/custom.db"
python3 - "$T/db/custom.db" <<'PY'   # today's stat row survived with NEWER numbers; the snapshot only knows day 20746
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.execute('DELETE FROM ReviewLog WHERE day=20747')            # day 20747 has no snapshot DailyStat either
c.execute('INSERT INTO DailyStat VALUES ("me", 20746, 9)')    # newer live value the snapshot must not clobber
c.commit(); c.close()
PY
snapshot_db "$T/db/sync/rah-latest.db"
runrepair
assert "14a newer live DailyStat kept (no clobber)" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT reviews FROM DailyStat WHERE day=20746\").fetchone()[0]==9"
assert "14b no invented row for the unsnapshotted day" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM DailyStat\").fetchone()[0]==1"
ok "14 DailyStat partial loss is honest (restore only what the snapshot proves)"

# --- 15. repair is idempotent: second run is a no-op ------------------------
newenv
damaged_db "$T/db/custom.db"
snapshot_db "$T/db/sync/rah-latest.db"
runrepair
cp "$T/db/custom.db" "$T/after1.db"
runrepair
assert "15a second repair changes nothing" python3 -c "
import sqlite3
a=sqlite3.connect('$T/after1.db'); b=sqlite3.connect('$T/db/custom.db')
for t in ('CardState','DailyStat','ReviewLog'):
    assert a.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0] == b.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
assert b.execute(\"SELECT due FROM CardState WHERE cardId='phr080'\").fetchone()[0]==20749"
ok "15 repair is idempotent (safe to run at every boot)"

# --- 16. vault clone is a boot-restore source (Task 87-d) -------------------
# No db/sync, NO OSS mount, no dated backups - ONLY the private vault clone's
# rah-latest.db. The first boot responder must recover the learner from it
# instead of "starting clean" (the drill-found gap: migrate would then create
# an empty db and the later restore-if-missing would no-op against it).
newenv
mkdir -p "$T/db/vault-work/rah-web"
snapshot_db "$T/db/vault-work/rah-web/rah-latest.db"
run boot
assert "16a vault-only boot restores the learner" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT xp FROM Learner WHERE id='me'\").fetchone()[0]==210"
assert "16b vault-restored db holds the schedule" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me'\").fetchone()[0]==3"
ok "16 boot restore includes the vault clone (offsite last defense)"

# --- 17. DailyStat ledger extension (Task 91): non-review days restored -----
# Found by the Task-91 phase-2 drill re-run: the review-keyed pass restores
# only days with ReviewLog rows, so a REAL practice day whose activity was
# xp/listening-only (no reviews) was dropped even though the verified
# snapshot held it (2026-10-23: xp 60 + one listen, zero reviews). The ledger
# extension restores every snapshot-held DailyStat row for a triggered user:
# snapshot-present + live-absent = provably deleted. Here day 20748 has NO
# ReviewLog backing but IS in the snapshot - it must come back; day 20747 is
# review-backed but NOT in the snapshot - it must stay absent (never invent).
newenv
damaged_db "$T/db/custom.db"
mkdir -p "$T/db/sync"
python3 - "$T/db/sync/rah-latest.db" <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
c.executescript('''
CREATE TABLE "Learner" (id TEXT PRIMARY KEY, xp INTEGER, streak INTEGER, lastActiveDay INTEGER, gems INTEGER, sp INTEGER);
CREATE TABLE "ReviewLog" (id INTEGER PRIMARY KEY, userId TEXT, cardId TEXT, grade INTEGER, day INTEGER);
CREATE TABLE "CardState" (userId TEXT, cardId TEXT, due INTEGER, reps INTEGER, PRIMARY KEY (userId, cardId));
CREATE TABLE "DailyStat" (userId TEXT, day INTEGER, reviews INTEGER, PRIMARY KEY (userId, day));
''')
c.execute('INSERT INTO Learner VALUES ("me", 210, 2, 20746, 70, 0)')
c.executemany('INSERT INTO CardState VALUES (?,?,?,?)',
              [("me", "phr080", 20749, 1), ("me", "phr086", 20750, 1), ("me", "awl114", 20749, 1)])
c.execute('INSERT INTO DailyStat VALUES ("me", 20746, 2)')   # review-backed day
c.execute('INSERT INTO DailyStat VALUES ("me", 20748, 0)')   # non-review xp/listen day - the Task-91 class
c.commit(); c.close()
PY
runrepair
assert "17a non-review snapshot day restored by the ledger extension" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM DailyStat WHERE day=20748\").fetchone()[0]==1"
assert "17b review-backed snapshot day restored" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM DailyStat WHERE day=20746\").fetchone()[0]==1"
assert "17c unsnapshotted review day still never invented" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM DailyStat WHERE day=20747\").fetchone()[0]==0"
assert "17d schedule restored alongside" python3 -c "import sqlite3; c=sqlite3.connect('$T/db/custom.db'); assert c.execute(\"SELECT COUNT(*) FROM CardState WHERE userId='me'\").fetchone()[0]==3"
ok "17 DailyStat ledger extension: non-review practice days survive (Task 91)"

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
