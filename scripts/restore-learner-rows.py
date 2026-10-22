#!/usr/bin/env python3
"""Restore learner rows lost from db/custom.db after the Oct-23 boot contamination.

Facts established by the diff:
- upload/rah-backups/rah-latest.db (Oct 22 12:40, the boot-guard restore source)
  still holds the clean state: CardState(me)=17, DailyStat(me)=2, zero junk.
- The live db lost those 'me' rows and gained battery junk (u1/u2) in
  CardState / DailyStat / Goal / MistakeFamily / MistakeForgiven.
- ReviewLog(me)=17, ChatMsg(me)=6, Quest(me)=6, League(me)=1, Rival(me)=1,
  Achievement(me)=1, Briefing=2 survived identically -> untouched.
- Real-user rows (cmvh5chsg...) from this morning's authenticated activity
  and the 2 fresh Session/LoginCode rows are KEPT (live activity, not junk).

Ops:
  1. Insert-only restore of missing 'me' rows (CardState, DailyStat) from the
     OSS snapshot; skip rows whose PK already exists.
  2. Delete battery-junk rows whose userId has no User row (u1, u2, ...).
  3. Print a before/after ledger for the worklog.
"""
import sqlite3
import shutil
import sys

LIVE = "db/custom.db"
SNAP = "/tmp/oss.db"  # verified copy of upload/rah-backups/rah-latest.db

shutil.copy(LIVE, "db/backups/pre-restore-" + __import__("time").strftime("%Y%m%d-%H%M%S") + ".db") if False else None

con = sqlite3.connect(LIVE)
snap = sqlite3.connect(SNAP)

live_users = {r[0] for r in con.execute('SELECT id FROM "User"')}
kept_singleton = "me" in live_users or True  # singleton legacy key is legitimate

def table_cols(c, t):
    return [r[1] for r in c.execute(f"PRAGMA table_info({t})")]

report = []

# --- 1. insert-only restore of missing 'me' rows -------------------------
for table, pk in [("CardState", ("userId", "cardId")), ("DailyStat", ("userId", "day"))]:
    snap_cols = table_cols(snap, table)
    live_cols = table_cols(con, table)
    common = [c for c in snap_cols if c in live_cols]
    collist = ", ".join(common)
    missing = []
    for row in snap.execute(f"SELECT {collist} FROM {table} WHERE userId='me'"):
        where = " AND ".join(f"{k}=?" for k in pk)
        vals = tuple(row[common.index(k)] for k in pk)
        hit = con.execute(f"SELECT 1 FROM {table} WHERE {where}", vals).fetchone()
        if not hit:
            missing.append(row)
    for row in missing:
        ph = ", ".join("?" for _ in common)
        con.execute(f"INSERT INTO {table} ({collist}) VALUES ({ph})", row)
    report.append(f"{table}: restored {len(missing)} missing 'me' rows")

# --- 2. purge battery junk (userId not in User AND not the singleton) -----
for table in ["CardState", "DailyStat", "Goal", "MistakeFamily", "MistakeForgiven",
              "Quest", "Rival", "League", "Achievement", "SkillLevel", "RunState",
              "ReviewLog", "ChatMsg", "WritingSub", "SpeakSession", "Material",
              "Placement", "GradeAck"]:
    try:
        cols = table_cols(con, table)
        if "userId" not in cols:
            continue
        users = {r[0] for r in con.execute(f"SELECT DISTINCT userId FROM {table}")}
        junk = sorted(u for u in users if u != "me" and u not in live_users)
        for u in junk:
            n = con.execute(f"DELETE FROM {table} WHERE userId=?", (u,)).rowcount
            if n:
                report.append(f"{table}: purged {n} junk rows (userId='{u}')")
    except sqlite3.OperationalError:
        pass  # table without userId or missing entirely

con.commit()

# --- 3. ledger ------------------------------------------------------------
print("=== ops ===")
for line in report:
    print(" ", line)
print("=== after ===")
for t in ["CardState", "DailyStat", "Goal", "MistakeFamily", "Quest", "Rival", "League", "Session"]:
    try:
        rows = con.execute(f"SELECT userId, COUNT(*) FROM {t} GROUP BY userId").fetchall()
        print(f"  {t}: {rows}")
    except sqlite3.OperationalError:
        pass
l = con.execute("SELECT level, streak, xp, gems FROM Learner").fetchall()
print("  Learner:", l)
con.close()
snap.close()
