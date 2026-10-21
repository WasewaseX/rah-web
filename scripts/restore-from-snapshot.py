#!/usr/bin/env python3
"""Task 62: restore the learner's 14-row state (recovered from the public
repo's db/sync/rah-latest.db snapshot, Oct-20 21:05 UTC) into the live DB.
Keeps live auth tables (Session/LoginCode) and today's bootstrap rows
(Quest/Rival/League). Restores: Learner, User, Achievement, CardState,
ReviewLog, DailyStat, Briefing (the snapshot's non-zero tables beyond
bootstrap)."""
import sqlite3, sys

LIVE = "/home/z/my-project/db/custom.db"
SNAP = sys.argv[1] if len(sys.argv) > 1 else "/tmp/rah-latest-inspect.db"

RESTORE = ["Learner", "User", "Achievement", "CardState", "ReviewLog", "DailyStat", "Briefing"]

live = sqlite3.connect(LIVE)
snap = sqlite3.connect(f"file:{SNAP}?mode=ro", uri=True)
live.execute("PRAGMA foreign_keys=OFF")
live.execute("ATTACH DATABASE ? AS snap", (SNAP,))

print("BEFORE:")
for t in RESTORE + ["Session", "LoginCode", "Quest", "Rival", "League"]:
    n = live.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
    print(f"  {t}: {n}")

cur = live.cursor()
cur.execute("BEGIN IMMEDIATE")
try:
    for t in RESTORE:
        cols = [r[1] for r in live.execute(f'PRAGMA snap.table_info("{t}")')]
        collist = ", ".join(f'"{c}"' for c in cols)
        cur.execute(f'DELETE FROM "{t}"')
        cur.execute(f'INSERT INTO "{t}" ({collist}) SELECT {collist} FROM snap."{t}"')
    cur.execute("COMMIT")
except Exception:
    cur.execute("ROLLBACK")
    raise

print("AFTER:")
for t in RESTORE + ["Session", "LoginCode", "Quest"]:
    n = live.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
    print(f"  {t}: {n}")
u = live.execute('SELECT email, name FROM "User"').fetchone()
l = live.execute('SELECT xp, streak, lastActiveDay FROM "Learner"').fetchone()
a = live.execute('SELECT key FROM "Achievement"').fetchall()
print(f"  User: {u}")
print(f"  Learner xp/streak/lastActiveDay: {l}")
print(f"  Achievements: {a}")
live.execute("DETACH DATABASE snap")
live.close()
snap.close()
print("RESTORE OK")
