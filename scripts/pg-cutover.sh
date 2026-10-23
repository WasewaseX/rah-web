#!/usr/bin/env bash
# Task 89-h: the PostgreSQL PHYSICAL CUTOVER as one guarded command.
#
# Task 74 validated the PG path (schema + concurrent grade writes + gid
# idempotency + isolation + logical restore) against a real PG 17.5 sandbox.
# What remained was the physical flip on the real deployment. This script is
# that runbook, executable and guarded:
#
#   pg-cutover.sh                  (dry-run: prints the plan, touches nothing)
#   pg-cutover.sh --sandbox        prove EVERYTHING against a userspace PG:
#                                  provision -> schema -> copy LIVE learner
#                                  data -> verify counts. SQLite untouched.
#   pg-cutover.sh --pg-url <url>   the same proof against a real PG server
#   pg-cutover.sh --flip <url>     ALSO flip the deployment: rewrites .env's
#                                  DATABASE_URL (with a timestamped backup)
#                                  and prints the restart + rollback steps.
#                                  Guarded by an explicit second confirm.
#
# The flip leg requires a TCP-reachable PG (Prisma). The sandbox is
# unix-socket (that is how pgserver wheels run), so --sandbox proves schema +
# data + verification and STOPS before the flip honestly.
set -uo pipefail
cd /home/z/my-project || exit 1

MODE="dry-run"
PG_URL=""
for arg in "$@"; do
  case "$arg" in
    --sandbox) MODE="sandbox" ;;
    --pg-url)  MODE="external" ;;
    --flip)    MODE="flip" ;;
    *) PG_URL="$arg" ;;
  esac
done

SQLITE="db/custom.db"
PGVENV="/home/z/rah-pg/pgvenv"
PGDATA="/home/z/rah-pg/pgdata"
SCHEMA_SQL="scripts/out/pg-schema.sql"

echo "== pg-cutover ($MODE) =="

# ---------- preflight (every mode) ----------
[ -f "$SQLITE" ] || { echo "ABORT: $SQLITE missing"; exit 1; }
[ -f prisma/schema.postgres.prisma ] || { echo "ABORT: PG schema missing"; exit 1; }
LEARNER=$(python3 -c "
import sqlite3
c = sqlite3.connect('file:$SQLITE?mode=ro', uri=True)
r = c.execute(\"SELECT xp, streak FROM Learner WHERE id='me'\").fetchone()
print(f'xp={r[0]} streak={r[1]}' if r else 'MISSING')
c.close()")
echo "preflight: live learner $LEARNER (SQLite remains the live store unless --flip runs)"

# ---------- schema SQL (offline, no PG needed) ----------
if [ ! -f "$SCHEMA_SQL" ] || [ prisma/schema.postgres.prisma -nt "$SCHEMA_SQL" ]; then
  echo "schema: generating full DDL via prisma migrate diff (offline baselining)"
  bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.postgres.prisma --script > "$SCHEMA_SQL" 2>/dev/null \
    || { echo "ABORT: migrate diff failed"; exit 1; }
fi
echo "schema: $SCHEMA_SQL ready ($(grep -c 'CREATE TABLE' "$SCHEMA_SQL") tables, $(grep -c 'CREATE INDEX\|CREATE UNIQUE INDEX' "$SCHEMA_SQL") indexes)"

# ---------- sandbox provisioning ----------
PSQL="psql"
PSQL_ARGS=""
if [ "$MODE" = "sandbox" ]; then
  PY="$PGVENV/bin/python"
  [ -x "$PY" ] || { echo "ABORT: $PY missing (uv venv $PGVENV --python 3.12 && uv pip install --python $PGVENV/bin/python pgserver)"; exit 1; }
  PGBIN="$PGVENV/lib/python3.12/site-packages/pgserver/pginstall/bin"
  [ -x "$PGBIN/psql" ] || PGBIN="$(dirname "$(find "$PGVENV" -name psql -type f 2>/dev/null | head -1)")"
  [ -x "$PGBIN/psql" ] || { echo "ABORT: bundled psql not found in the pgserver wheel"; exit 1; }
  PSQL="$PGBIN/psql"
  mkdir -p "$(dirname "$PGDATA")"
  SOCK="$("$PY" -c "
import pgserver, os
os.environ.setdefault('XDG_RUNTIME_DIR', '/tmp/runtime-1001')
s = pgserver.get_server('$PGDATA')
print(s.get_uri().split('host=')[-1])")" || { echo "ABORT: sandbox PG failed to start"; exit 1; }
  "$PSQL" -X -q -h "$SOCK" -U postgres -d postgres -c "CREATE DATABASE rah" 2>/dev/null || true
  PSQL_ARGS=(-h "$SOCK" -U postgres -d rah)
  echo "sandbox: userspace PG at socket $SOCK (db rah) - unix-socket only, flip leg NOT applicable here"
elif [ "$MODE" = "external" ] || [ "$MODE" = "flip" ]; then
  [ -n "$PG_URL" ] || { echo "ABORT: --pg-url/--flip need the url as the next argument"; exit 1; }
  command -v psql >/dev/null || { echo "ABORT: psql not on PATH for the external/flip leg"; exit 1; }
  PSQL_ARGS=("$PG_URL")
fi

if [ "$MODE" = "dry-run" ]; then
  cat <<EOF
plan (dry-run - nothing executed):
  1. psql <target> -f $SCHEMA_SQL          (fresh schema; refuses if rah has tables unless TRUNCATE leg is run)
  2. python3 scripts/pg_copy_data.py copy $SQLITE <psql args>   (TRUNCATE + COPY of 30 tables, ids preserved, sequences reset)
  3. python3 scripts/pg_copy_data.py verify $SQLITE <psql args> (per-table counts + learner checksum)
  4. flip (only with --flip): backup .env + schema.prisma, swap DATABASE_URL,
        switch the schema provider, rebuild a PG-baseline migration history
        (SQLite history preserved aside), regenerate the client + rebuild the
        standalone bundle, then YOU run:
       bunx prisma migrate resolve --applied 00000000000000_pg_baseline
       bash scripts/ensure-server.sh
     rollback: restore .env + schema.prisma backups, restore the SQLite
     migration history, regenerate + rebuild, restart. SQLite stays untouched the whole time.
run --sandbox to prove steps 1-3 against a userspace PG now.
EOF
  exit 0
fi

# ---------- execute: schema + copy + verify ----------
echo "== schema apply =="
"$PSQL" -X -v ON_ERROR_STOP=1 -q "${PSQL_ARGS[@]}" -f "$SCHEMA_SQL" || { echo "ABORT: schema apply failed"; exit 1; }
echo "schema applied"

echo "== data copy (SQLite -> PG, live learner db, read-only) =="
python3 scripts/pg_copy_data.py copy "$SQLITE" "${PSQL_ARGS[@]}" || { echo "ABORT: data copy failed"; exit 1; }

echo "== verification =="
python3 scripts/pg_copy_data.py verify "$SQLITE" "${PSQL_ARGS[@]}" && echo "== PG CUTOVER PROOF: ALL COUNTS MATCH ==" || { echo "== verification FAILED - the flip must not proceed =="; exit 1; }

if [ "$MODE" = "flip" ]; then
  if ! [ "${RAH_FLIP_CONFIRM:-}" = "yes" ]; then
    echo "flip: RAH_FLIP_CONFIRM=yes required (set it and re-run to actually rewrite .env)"
    exit 0
  fi
  TS=$(date +%Y%m%d-%H%M%S)
  cp .env ".env.bak.$TS"
  cp prisma/schema.prisma "prisma/schema.prisma.bak.$TS"
  python3 - "$PG_URL" <<'PYEOF'
import sys, re
url = sys.argv[1]
lines = open(".env").read().splitlines()
out, seen = [], False
for ln in lines:
    if ln.startswith("DATABASE_URL="):
        out.append(f"DATABASE_URL={url}")
        seen = True
    else:
        out.append(ln)
if not seen:
    out.append(f"DATABASE_URL={url}")
open(".env", "w").write("\n".join(out) + "\n")
print(f"flip: .env DATABASE_URL swapped (backup .env.bak.{TS})")
PYEOF

  # Task 92 drill-found GAP 1: the .env swap alone boots a SQLITE query
  # engine against PostgreSQL - every real DB call fails. The provider must
  # switch with it and the client must be REGENERATED + the standalone bundle
  # REBUILT (the client is a build-time copy inside .next/standalone).
  sed -i 's|provider = "sqlite"|provider = "postgresql"|' prisma/schema.prisma
  echo "flip: schema provider sqlite -> postgresql (backup prisma/schema.prisma.bak.$TS)"

  # Task 92 drill-found GAP 2: the migration history is SQLite-locked
  # (migration_lock.toml + dialect-specific migration SQL). A PG cutover needs
  # a one-time PG baseline: preserve the SQLite history aside, then create a
  # fresh history holding ONE baseline migration generated from the PG schema.
  mv prisma/migrations "prisma/migrations.sqlite.bak.$TS"
  mkdir -p prisma/migrations/00000000000000_pg_baseline
  printf 'provider = "postgresql"' > prisma/migrations/migration_lock.toml
  cp scripts/out/pg-schema.sql prisma/migrations/00000000000000_pg_baseline/migration.sql
  echo "flip: PG migration baseline created (SQLite history preserved as prisma/migrations.sqlite.bak.$TS)"

  echo "flip: regenerating client + rebuilding standalone (required - do not skip)"
  bunx prisma generate --schema prisma/schema.prisma || { echo "ABORT: generate failed - RESTORE the backups"; exit 1; }
  bash scripts/build-prod.sh || { echo "ABORT: rebuild failed - RESTORE the backups"; exit 1; }

  cat <<EOF
flip leg done. Now run BY HAND (deliberate, not automated):
  bunx prisma migrate resolve --applied 00000000000000_pg_baseline --schema prisma/schema.prisma
  bash scripts/ensure-server.sh
VERIFY: /api/version data.xp must match the SQLite preflight value.
ROLLBACK (all four artifacts): \
cp ".env.bak.$TS" .env && \
cp "prisma/schema.prisma.bak.$TS" prisma/schema.prisma && \
rm -rf prisma/migrations && mv "prisma/migrations.sqlite.bak.$TS" prisma/migrations && \
bunx prisma generate && bash scripts/build-prod.sh && bash scripts/ensure-server.sh
NOTE: a shell-exported DATABASE_URL silently overrides .env (dotenv semantics:
process env wins). Check `env | grep DATABASE_URL` before diagnosing.
EOF
fi
