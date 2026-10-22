#!/usr/bin/env python3
"""Task 63: restore learner rows from a vault snapshot into the live DB.

Column-intersection semantics: for each table, copy only the columns that
exist in BOTH databases, so a pre-isolation-schema snapshot (no userId)
restores cleanly into the new schema (userId takes its default "me" - correct,
the learner IS the singleton). Auth (Session/LoginCode) and today's bootstrap
rows (Quest/Rival/League/Placement/RunState) are NEVER touched: the live
session stays valid and the daily bootstrap is fresher than any snapshot.

Usage: python3 scripts/restore-from-vault.py <snapshot.db> [--dry-run]
"""
import sqlite3, sys

LIVE = "/home/z/my-project/db/custom.db"
SNAP = sys.argv[1] if len(sys.argv) > 1 else "db/vault-work/rah-web/history/rah-20261021T225730Z.db"
DRY = "--dry-run" in sys.argv

# Privacy/progress tables only. Bootstrap + auth + content decks stay live.
RESTORE = ["Learner", "User", "Achievement", "CardState", "ReviewLog",
           "DailyStat", "ChatMsg", "WritingSub", "SpeakSession", "Briefing"]

live = sqlite3.connect(LIVE)
snap = sqlite3.connect(f"file:{SNAP}?mode=ro", uri=True)
live.execute("PRAGMA foreign_keys=OFF")
live.execute("ATTACH DATABASE ? AS snap", (SNAP,))

plan = []
for t in RESTORE:
    live_cols = [r[1] for r in live.execute(f'PRAGMA table_info("{t}")')]
    try:
        snap_cols = [r[1] for r in live.execute(f'PRAGMA snap.table_info("{t}")')]
    except Exception:
        print(f"  {t}: absent in snapshot - skipped"); continue
    common = [c for c in snap_cols if c in live_cols]
    n = live.execute(f'SELECT COUNT(*) FROM snap."{t}"').fetchone()[0]
    plan.append((t, common, n))
    print(f"  {t}: {n} rows, {len(common)}/{len(live_cols)} live columns filled")

if DRY:
    print("DRY RUN - nothing written"); sys.exit(0)

cur = live.cursor()
cur.execute("BEGIN IMMEDIATE")
try:
    for t, cols, _ in plan:
        collist = ", ".join(f'"{c}"' for c in cols)
        cur.execute(f'DELETE FROM "{t}"')
        cur.execute(f'INSERT INTO "{t}" ({collist}) SELECT {collist} FROM snap."{t}"')
    cur.execute("COMMIT")
except Exception:
    cur.execute("ROLLBACK")
    raise

print("AFTER:")
for t in ("Learner", "User", "ReviewLog", "CardState", "ChatMsg", "WritingSub", "SpeakSession", "Session"):
    try:
        n = live.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        print(f"  {t}: {n}")
    except Exception as e:
        print(f"  {t}: err {e}")
print("  Learner:", live.execute('SELECT xp, streak FROM "Learner"').fetchall())
print("  Achievements:", live.execute('SELECT key FROM "Achievement"').fetchall())
live.execute("DETACH DATABASE snap")
live.close(); snap.close()
print("RESTORE OK")
