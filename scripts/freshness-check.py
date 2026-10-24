#!/usr/bin/env python3
"""Freshness chain check: live DB == local sync snapshot == vault clone == upload stage.
Also asserts Session/LoginCode scrub on every snapshot copy (REG-2 doctrine).
Exit 0 = chain healthy; exit 1 = mismatch (printed)."""
import os
import sqlite3
import sys

ROOT = os.environ.get("GUARD_ROOT", "/home/z/my-project")
PATHS = {
    "LIVE": os.path.join(ROOT, "db/custom.db"),
    "SYNC": os.path.join(ROOT, "db/sync/rah-latest.db"),
    "VAULT": os.path.join(ROOT, "db/vault-work/rah-web/rah-latest.db"),
    "UPLOAD": os.path.join(ROOT, "upload/rah-backups/rah-latest.db"),
}


def sig(con, uid):
    xp = con.execute("SELECT xp, streak FROM Learner WHERE id='me'").fetchone()
    rev = con.execute("SELECT COUNT(*) FROM ReviewLog WHERE userId=?", (uid,)).fetchone()[0]
    days = con.execute("SELECT COUNT(*) FROM DailyStat WHERE userId=?", (uid,)).fetchone()[0]
    sess = con.execute("SELECT COUNT(*) FROM Session").fetchone()[0]
    codes = con.execute("SELECT COUNT(*) FROM LoginCode").fetchone()[0]
    return {
        "xp": xp[0] if xp else None,
        "streak": xp[1] if xp else None,
        "reviews": rev,
        "days": days,
        "sessions": sess,
        "login_codes": codes,
        "ledger_uid": uid[:8],
    }


def main():
    out = {}
    missing = []
    uid = None
    for name, path in PATHS.items():
        if not os.path.exists(path):
            missing.append(f"{name}: {path}")
            continue
        con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            # Task 92-ter: resolve the REAL ledger user (the auth User cuid).
            # The legacy 'me' id was merged away - filtering 'me' here would
            # read zeros everywhere and false-green the whole chain.
            if uid is None:
                row = con.execute("SELECT id FROM User ORDER BY createdAt LIMIT 1").fetchone()
                uid = row[0] if row else "me"
            out[name] = sig(con, uid)
        finally:
            con.close()
        print(f"{name:7s}: {out[name]}")
    if missing:
        print("MISSING:\n  " + "\n  ".join(missing))
        sys.exit(1)

    live = out["LIVE"]
    data_match = all(
        out[k]["xp"] == live["xp"]
        and out[k]["reviews"] == live["reviews"]
        and out[k]["days"] == live["days"]
        for k in ("SYNC", "VAULT", "UPLOAD")
    )
    scrub_ok = all(out[k]["sessions"] == 0 and out[k]["login_codes"] == 0 for k in ("SYNC", "VAULT", "UPLOAD"))
    print(f"DATA MATCH: {'YES' if data_match else 'NO'}   SCRUB (Session/LoginCode=0): {'YES' if scrub_ok else 'NO'}")
    sys.exit(0 if (data_match and scrub_ok) else 1)


if __name__ == "__main__":
    main()
