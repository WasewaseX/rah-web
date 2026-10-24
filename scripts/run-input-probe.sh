#!/usr/bin/env bash
# Task 94: mint a one-shot real session and run the input-latency probe
# authenticated (review/write/coach all live behind the session gate). Same
# pattern as run-interactivity-prod.sh: hashed-at-rest session, probe- id
# prefix, trap cleanup. NOTE: the coach leg posts a REAL coach turn - it
# writes one ChatMsg pair under the authenticated user (the 92-ter-stamped
# path) and bumps DailyStat; that is live learner data by design, same as
# boot-regression's coach leg.
set -eu
cd /home/z/my-project

TOKEN="$(python3 - <<'PY'
import hashlib, secrets, sqlite3, time
raw = secrets.token_hex(32)
hashed = hashlib.sha256(raw.encode()).hexdigest()
con = sqlite3.connect("/home/z/my-project/db/custom.db")
uid = con.execute("SELECT id FROM User LIMIT 1").fetchone()[0]
con.execute(
    "INSERT INTO Session (id, token, userId, expiresAt, createdAt) VALUES (?,?,?,?,?)",
    (f"probe-input-{int(time.time())}", hashed, uid,
     time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() + 900)),
     time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())),
)
con.commit(); con.close()
print(raw)
PY
)"

trap 'python3 - <<PY
import sqlite3
con = sqlite3.connect("/home/z/my-project/db/custom.db")
con.execute("DELETE FROM Session WHERE id LIKE \"probe-input-%\"")
con.commit(); con.close()
PY' EXIT

RAH_SESSION="rah_session=${TOKEN}" node scripts/input-latency-probe.mjs "${1:-94}"
