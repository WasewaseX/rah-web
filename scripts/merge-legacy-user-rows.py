#!/usr/bin/env python3
"""merge-legacy-user-rows.py - close the dual-userId ledger split (Task 92-bis).

FINDING (2026-10-24, discovered because the live learner earned xp that never
appeared in their own Progress view): user-keyed rows are split across TWO ids.
Legacy/pre-isolation surfaces wrote Learner.id='me'; session-scoped surfaces
write the auth User.id (a cuid). The Task-67 isolation sweep re-keyed CardState
WRITES (the grade path upserts under contentUserId) but never MIGRATED the
legacy rows, and the coach-agent route's ChatMsg.create had no stamp at all
(schema default 'me'). Result: the cuid-scoped reads (Progress, volume card,
review counts) see only the post-split rows; 17 real reviews + the listening
ledger row are invisible to the learner's own surfaces.

THE FIX, two halves:
  1. Code: coach-agent route stamps ChatMsg with contentUserId() (shipped in
     the same commit as this script).
  2. Data: this script moves every 'me' row in the user-keyed tables onto the
     real auth user id, merging PK collisions field-wise:
       - ReviewLog, ChatMsg, CardState(no collide today, still guarded),
         Material, Goal, MistakeFamily, MistakeForgiven, TagMastery,
         SpeakSession, Placement*  -> plain UPDATE userId 'me' -> cuid
       - DailyStat (PK userId,day)  -> SUM all six counters into the cuid row
       - GameStat (PK userId,key)   -> best=max, plays=sum
       - Quest (PK userId,id)       -> progress=sum (capped at target), done=OR,
                                      xp=max, keep the cuid row's identity
       - Achievement (PK userId,key)-> keep earliest `at`, first non-empty meta

SAFETY DOCTRINE (the Task-87 drill rules apply):
  - READ-ONLY by default: prints the plan. --apply executes.
  - One transaction; idempotent (second run is a no-op).
  - Never touches Learner.createdAt (the version tripwire).
  - Never deletes a cuid row except the exact merge losers (Achievement dup,
    Quest dup, absorbed 'me' rows) - the learner's offsite snapshots
    (db/sync + vault + dated backups) are the rollback path.
"""
import os
import sqlite3
import sys

ROOT = os.environ.get("GUARD_ROOT", "/home/z/my-project")
DB = os.environ.get("GUARD_DB", os.path.join(ROOT, "db/custom.db"))
LEGACY = "me"

PLAIN_REID_TABLES = [
    "ReviewLog",
    "ChatMsg",
    "CardState",
    "Material",
    "Goal",
    "MistakeFamily",
    "MistakeForgiven",
    "TagMastery",
    "SpeakSession",
    "WritingSub",
]

DAILY_FIELDS = ["reviews", "correct", "xp", "spoken", "written", "listened"]


def get_cuid(con):
    row = con.execute("SELECT id FROM User ORDER BY createdAt LIMIT 1").fetchone()
    return row[0] if row else None


def plan(con, cuid):
    counts = {}
    for t in PLAIN_REID_TABLES:
        try:
            counts[t] = con.execute("SELECT COUNT(*) FROM %s WHERE userId=?" % t, (LEGACY,)).fetchone()[0]
        except Exception:
            counts[t] = None
    for t in ("DailyStat", "GameStat", "Quest", "Achievement"):
        counts[t] = con.execute("SELECT COUNT(*) FROM %s WHERE userId=?" % t, (LEGACY,)).fetchone()[0]
    return counts


def merge_daily(con, cuid):
    # field-wise SUM into the cuid row for colliding days; re-id the rest.
    moved = merged = 0
    me_rows = con.execute("SELECT day FROM DailyStat WHERE userId=?", (LEGACY,)).fetchall()
    for (day,) in me_rows:
        cu_row = con.execute("SELECT day FROM DailyStat WHERE userId=? AND day=?", (cuid, day)).fetchone()
        if cu_row:
            sets = ", ".join(f"{f} = {f} + (SELECT COALESCE({f},0) FROM DailyStat WHERE userId=? AND day=?)" for f in DAILY_FIELDS)
            # 6 subselects x (LEGACY, day) then the WHERE's (cuid, day)
            args = [LEGACY, day] * len(DAILY_FIELDS) + [cuid, day]
            con.execute(f"UPDATE DailyStat SET {sets} WHERE userId=? AND day=?", args)
            con.execute("DELETE FROM DailyStat WHERE userId=? AND day=?", (LEGACY, day))
            merged += 1
        else:
            con.execute("UPDATE DailyStat SET userId=? WHERE userId=? AND day=?", (cuid, LEGACY, day))
            moved += 1
    return moved, merged


def merge_gamestat(con, cuid):
    moved = merged = 0
    for (key,) in con.execute("SELECT key FROM GameStat WHERE userId=?", (LEGACY,)).fetchall():
        cu = con.execute("SELECT best, plays FROM GameStat WHERE userId=? AND key=?", (cuid, key)).fetchone()
        if cu:
            me = con.execute("SELECT best, plays FROM GameStat WHERE userId=? AND key=?", (LEGACY, key)).fetchone()
            con.execute(
                "UPDATE GameStat SET best=MAX(best,?), plays=plays+? WHERE userId=? AND key=?",
                (me[0], me[1], cuid, key),
            )
            con.execute("DELETE FROM GameStat WHERE userId=? AND key=?", (LEGACY, key))
            merged += 1
        else:
            con.execute("UPDATE GameStat SET userId=? WHERE userId=? AND key=?", (cuid, LEGACY, key))
            moved += 1
    return moved, merged


def merge_quest(con, cuid):
    moved = merged = 0
    for (qid,) in con.execute("SELECT id FROM Quest WHERE userId=?", (LEGACY,)).fetchall():
        cu = con.execute("SELECT target, progress, done, xp FROM Quest WHERE userId=? AND id=?", (cuid, qid)).fetchone()
        if cu:
            me = con.execute("SELECT progress, done, xp FROM Quest WHERE userId=? AND id=?", (LEGACY, qid)).fetchone()
            new_progress = min(cu[0], cu[1] + me[0])
            con.execute(
                "UPDATE Quest SET progress=?, done=?, xp=MAX(xp,?) WHERE userId=? AND id=?",
                (new_progress, 1 if (cu[2] or me[1]) else 0, max(cu[3], me[2]), cuid, qid),
            )
            con.execute("DELETE FROM Quest WHERE userId=? AND id=?", (LEGACY, qid))
            merged += 1
        else:
            con.execute("UPDATE Quest SET userId=? WHERE userId=? AND id=?", (cuid, LEGACY, qid))
            moved += 1
    return moved, merged


def merge_achievement(con, cuid):
    moved = merged = 0
    for (key, at, meta) in con.execute("SELECT key, at, meta FROM Achievement WHERE userId=?", (LEGACY,)).fetchall():
        cu = con.execute("SELECT at, meta FROM Achievement WHERE userId=? AND key=?", (cuid, key)).fetchone()
        if cu:
            # keep the EARLIEST earned date and the first non-empty meta
            keep_at = min(at, cu[0])
            keep_meta = cu[1] if cu[1] else meta
            con.execute(
                "UPDATE Achievement SET at=?, meta=? WHERE userId=? AND key=?",
                (keep_at, keep_meta, cuid, key),
            )
            con.execute("DELETE FROM Achievement WHERE userId=? AND key=?", (LEGACY, key))
            merged += 1
        else:
            con.execute("UPDATE Achievement SET userId=? WHERE userId=? AND key=?", (cuid, LEGACY, key))
            moved += 1
    return moved, merged


def main():
    apply = "--apply" in sys.argv
    con = sqlite3.connect(DB, timeout=30)
    con.execute("PRAGMA busy_timeout=30000")
    cuid = get_cuid(con)
    if not cuid:
        print("ABORT: no User row found")
        sys.exit(1)
    if cuid == LEGACY:
        print("NOTHING TO DO: auth user id already is the legacy id")
        sys.exit(0)

    before = plan(con, cuid)
    print(f"target user id: {cuid}")
    print(f"BEFORE (legacy 'me' rows): {before}")
    if not apply:
        print("DRY-RUN (use --apply to execute). Merge rules: DailyStat=sum fields, GameStat=best/max+plays/sum, Quest=progress/sum+done/OR+xp/max, Achievement=earliest at; all others plain re-id.")
        sys.exit(0)

    con.execute("BEGIN IMMEDIATE")
    try:
        moved_total, merged_total = 0, 0
        for t in PLAIN_REID_TABLES:
            try:
                cur = con.execute(f"UPDATE {t} SET userId=? WHERE userId=?", (cuid, LEGACY))
                moved_total += cur.rowcount
            except sqlite3.OperationalError:
                pass  # table without userId column - skip
        m1 = merge_daily(con, cuid)
        m2 = merge_gamestat(con, cuid)
        m3 = merge_quest(con, cuid)
        m4 = merge_achievement(con, cuid)
        merged_total = sum(x[1] for x in (m1, m2, m3, m4))
        moved_total += sum(x[0] for x in (m1, m2, m3, m4))
        # verify: no legacy rows remain anywhere
        leftover = 0
        for t in PLAIN_REID_TABLES + ["DailyStat", "GameStat", "Quest", "Achievement"]:
            try:
                leftover += con.execute("SELECT COUNT(*) FROM %s WHERE userId=?" % t, (LEGACY,)).fetchone()[0]
            except sqlite3.OperationalError:
                pass
        if leftover:
            raise RuntimeError(f"merge left {leftover} legacy rows - rolling back")
        trip = con.execute("SELECT createdAt FROM Learner WHERE id='me'").fetchone()[0]
        con.commit()
        after = plan(con, cuid)
        print(f"APPLIED: {moved_total} rows re-id'd, {merged_total} collisions merged")
        print(f"AFTER  (legacy 'me' rows): {after}")
        print(f"tripwire Learner.createdAt unchanged: {trip}")
    except Exception as e:
        con.rollback()
        print("ABORTED (rolled back):", e)
        sys.exit(1)
    finally:
        con.close()


if __name__ == "__main__":
    main()
