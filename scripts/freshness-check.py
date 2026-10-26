#!/usr/bin/env python3
"""Freshness chain check: live DB == local sync snapshot == vault clone == upload stage.
Also asserts Session/LoginCode scrub on every snapshot copy (REG-2 doctrine).
Exit 0 = chain healthy; exit 1 = mismatch (printed).

Task 97 (PG era): when .env DATABASE_URL is postgresql, LIVE is read from the
PostgreSQL primary (Learner/ReviewLog/DailyStat counts) and the three snapshot
legs are the pg-survival.sh dump SIDECAR JSONs (db/backups, vault work tree,
upload stage). The SQLite legacy path is kept verbatim for a possible re-flip."""
import json
import os
import shutil
import sqlite3
import subprocess
import sys

ROOT = os.environ.get("GUARD_ROOT", "/home/z/my-project")
PATHS = {
    "LIVE": os.path.join(ROOT, "db/custom.db"),
    "SYNC": os.path.join(ROOT, "db/sync/rah-latest.db"),
    "VAULT": os.path.join(ROOT, "db/vault-work/rah-web/rah-latest.db"),
    "UPLOAD": os.path.join(ROOT, "upload/rah-backups/rah-latest.db"),
}
PG_SIDECARS = {
    "SYNC": os.path.join(ROOT, "db/backups/pg-rah-latest.json"),
    "VAULT": os.path.join(ROOT, "db/vault-work/rah-web/backups/pg-rah-latest.json"),
    "UPLOAD": os.path.join(ROOT, "upload/rah-backups/pg-rah-latest.json"),
}


def env_db_url():
    try:
        for line in open(os.path.join(ROOT, ".env")):
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    except OSError:
        pass
    return ""


def pg_counts(url):
    q = ("SELECT (SELECT xp FROM \"Learner\" WHERE id='me'),"
         " (SELECT streak FROM \"Learner\" WHERE id='me'),"
         " (SELECT COUNT(*) FROM \"ReviewLog\"),"
         " (SELECT COUNT(*) FROM \"DailyStat\"),"
         " (SELECT COUNT(*) FROM \"Session\"),"
         " (SELECT COUNT(*) FROM \"LoginCode\"),"
         " (SELECT id FROM \"User\" ORDER BY \"createdAt\" LIMIT 1)")
    # Task 98: bare "psql" is not on PATH in the userspace-PG deployment
    # (binaries live in the pgserver wheel). Resolve the same PGBIN default
    # pg-survival.sh uses, with PGBIN/env override.
    psql = shutil.which("psql") or os.path.join(
        os.environ.get("PGBIN",
                       "/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin"),
        "psql")
    row = subprocess.run(
        [psql, "-X", "-q", "-t", "-A", "-F", "|", url, "-c", q],
        capture_output=True, text=True, timeout=60).stdout.strip()
    xp, streak, rev, days, sess, codes, uid = (row.split("|") + [""] * 7)[:7]
    return {
        "xp": int(xp) if xp else None,
        "streak": int(streak) if streak else None,
        "reviews": int(rev or 0),
        "days": int(days or 0),
        "sessions": int(sess or 0),
        "login_codes": int(codes or 0),
        "ledger_uid": uid[:8],
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


def sqlite_mode():
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


def pg_mode(url):
    out = {}
    missing = []
    try:
        out["LIVE"] = pg_counts(url)
    except Exception as e:
        print(f"LIVE (PG): UNREACHABLE - {e}")
        sys.exit(1)
    print(f"LIVE   : {out['LIVE']}  (PostgreSQL primary)")
    for name, path in PG_SIDECARS.items():
        if not os.path.exists(path):
            missing.append(f"{name}: {path}")
            continue
        d = json.load(open(path))
        out[name] = {
            "xp": d.get("xp"), "streak": d.get("streak"),
            "reviews": d.get("reviews"), "days": d.get("days"),
            "sessions": d.get("sessions", 0), "login_codes": d.get("login_codes", 0),
            "ledger_uid": "dump:" + d.get("ts", "?"),
        }
        print(f"{name:7s}: {out[name]}")
    if missing:
        print("MISSING (run pg-survival.sh dump / extend vault-sync):\n  " + "\n  ".join(missing))
        sys.exit(1)
    live = out["LIVE"]
    data_match = all(
        out[k]["xp"] == live["xp"]
        and out[k]["reviews"] == live["reviews"]
        and out[k]["days"] == live["days"]
        for k in ("SYNC", "VAULT", "UPLOAD")
    )
    scrub_ok = all(out[k]["sessions"] == 0 and out[k]["login_codes"] == 0 for k in ("SYNC", "VAULT", "UPLOAD"))
    print(f"DATA MATCH: {'YES' if data_match else 'NO'}   SCRUB (dump excludes Session/LoginCode rows): {'YES' if scrub_ok else 'NO'}")
    sys.exit(0 if (data_match and scrub_ok) else 1)


def main():
    url = env_db_url()
    if url.startswith("postgresql://"):
        pg_mode(url)
    else:
        sqlite_mode()


if __name__ == "__main__":
    main()
