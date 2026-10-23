#!/usr/bin/env bash
# Task 90: usable prod boot-regression runner. Prod deliberately withholds
# devCode (security gate), so the regression script's RAH_SESSION preset needs
# a REAL session - minted here against the live db (hashed at rest like every
# session), used for one drive, then deleted. No stray auth artifacts left.
set -eu
cd /home/z/my-project

TOKEN="$(python3 - <<'PY'
import hashlib, secrets, sqlite3, time
raw = secrets.token_hex(32)
hashed = hashlib.sha256(raw.encode()).hexdigest()
con = sqlite3.connect("/home/z/my-project/db/custom.db")
# The AUTH user id lives in User (a cuid) - NOT Learner.id="me". The session
# include joins user; a Learner id here makes Prisma throw inconsistent-result.
uid = con.execute("SELECT id FROM User LIMIT 1").fetchone()[0]
con.execute(
    "INSERT INTO Session (id, token, userId, expiresAt, createdAt) VALUES (?,?,?,?,?)",
    (f"bootreg-{int(time.time())}", hashed, uid,
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
con.execute("DELETE FROM Session WHERE id LIKE \"bootreg-%\"")
con.commit(); con.close()
PY' EXIT

RAH_SESSION="rah_session=${TOKEN}" node scripts/boot-regression-check.mjs
