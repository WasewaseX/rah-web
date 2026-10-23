#!/usr/bin/env bash
# Task 92: PG-cutover regression - the SAME authenticated learner drive
# (state 200 + coach streaming) but against a PostgreSQL-backed instance.
# Mints a real hashed session IN PG, drives RAH_BASE (default :3100),
# deletes the session in a trap. SQLite is never touched.
set -eu
cd /home/z/my-project
BASE="${RAH_BASE:-http://localhost:3100}"
PG_URL="${PG_URL:-postgresql://postgres@127.0.0.1:5432/rah}"
PSQL="${PSQL:-psql}"

TOKEN="$($PSQL -X -t -A "$PG_URL" -c "
SELECT 'x' FROM pg_catalog.pg_tables WHERE tablename='User' LIMIT 1" >/dev/null 2>&1
python3 - "$PG_URL" <<'PY'
import hashlib, secrets, subprocess, sys, time
pg_url = sys.argv[1]
raw = secrets.token_hex(32)
hashed = hashlib.sha256(raw.encode()).hexdigest()
uid_sql = 'SELECT id FROM "User" LIMIT 1'
def q(sql):
    return subprocess.run(
        ["psql", "-X", "-t", "-A", pg_url, "-c", sql],
        capture_output=True, text=True, check=True).stdout.strip()
uid = q(uid_sql)
sid = f"bootreg-{int(time.time())}"
exp = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() + 900))
created = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
q(f"INSERT INTO \"Session\" (id, token, \"userId\", \"expiresAt\", \"createdAt\") "
  f"VALUES ('{sid}', '{hashed}', '{uid}', '{exp}', '{created}')")
print(raw)
PY
)"

trap '$PSQL -X -t -A "$PG_URL" -c "DELETE FROM \"Session\" WHERE id LIKE '"'"'bootreg-%'"'"'" >/dev/null' EXIT

RAH_SESSION="rah_session=${TOKEN}" RAH_BASE="${BASE}" node scripts/boot-regression-check.mjs
