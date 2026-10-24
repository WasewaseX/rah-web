#!/usr/bin/env bash
# Task 92-bis: mint a one-shot real session and run the interactivity probe
# authenticated (the lazy tabs live behind the session gate). Same pattern as
# run-boot-regression-prod.sh: hashed-at-rest session, id prefix, trap cleanup.
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
    (f"probe-{int(time.time())}", hashed, uid,
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
con.execute("DELETE FROM Session WHERE id LIKE \"probe-%\"")
con.commit(); con.close()
PY' EXIT

LABEL="${1:-run}"
TAB="${2:-Progress}"
RAH_SESSION="rah_session=${TOKEN}" node scripts/interactivity-probe.mjs "$LABEL" "http://localhost:3000/" "$TAB"
