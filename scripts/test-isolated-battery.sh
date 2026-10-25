#!/usr/bin/env bash
# Isolated battery (audit P1-10): the API battery runs against a THROWAWAY
# database and its own dev-server instance - the real learner's db/custom.db
# is never touched, not even by a restore.
#
# Usage:  bash scripts/test-isolated-battery.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=3100
BASE="http://localhost:$PORT"
DIST=".next-battery"

# Engine-agnostic throwaway (Task 97, post-PG-flip): the schema provider is
# whatever prisma/schema.prisma says. Derive the throwaway DATABASE_URL from
# the deployment's own .env: postgresql -> a throwaway DATABASE on the same
# local PG instance (dropped + recreated per run); file: -> the old SQLite
# throwaway file. Either way the live learner store is never touched.
ENV_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
case "$ENV_URL" in
  postgresql://*)
    PG_BASE_URL="${ENV_URL%/*}"            # strip the db name -> instance URL
    DB="$PG_BASE_URL/rah_battery"
    PGCLIENT="${PGCLIENT:-psql}"
    "$PGCLIENT" -X "$PG_BASE_URL/postgres" -c "DROP DATABASE IF EXISTS rah_battery WITH (FORCE)" >/dev/null 2>&1 || true
    "$PGCLIENT" -X "$PG_BASE_URL/postgres" -c "CREATE DATABASE rah_battery" >/dev/null
    ;;
  *)
    DB="file:/home/z/my-project/db/battery-isolated.db"
    ;;
esac

cleanup() {
  pkill -f "next dev -p $PORT" 2>/dev/null || true
  case "${DB:-}" in
    postgresql://*) "${PGCLIENT:-psql}" -X "${PG_BASE_URL:-}/postgres" -c "DROP DATABASE IF EXISTS rah_battery WITH (FORCE)" >/dev/null 2>&1 || true ;;
  esac
}
trap cleanup EXIT

echo "== isolated battery =="
echo "   db:     $DB"
echo "   server: $BASE (dist: $DIST)"

# The battery's auth-hardening/deletion sections register THROWAWAY fixture
# accounts - the Task-48 deployment lock must be open for THIS test stack
# only. Set here (not in .env): .env is machine-local and the lock must stay
# ACTIVE by default for any real deployment (worklog Task 48 lesson).
export RAH_OPEN_REGISTRATION=1

rm -f db/battery-isolated.db 2>/dev/null || true
DATABASE_URL="$DB" bunx prisma migrate deploy > /dev/null 2>&1
echo "== throwaway db migrated ($DB) =="
case "$DB" in
  file:*) rm -f db/battery-isolated.db-* ;;
esac

# The dev server for the test stack: own DB (process env beats .env) + own
# dist dir (Turbopack's .next/dev/lock is per dist dir).
# RAH_OPEN_REGISTRATION=1 is scoped to THIS throwaway stack only (the battery
# builds multi-user fixtures). The REAL deployment keeps the Task-48
# deployment lock active - the unlock never touches the shared .env.
RAH_OPEN_REGISTRATION=1 NEXT_DIST_DIR="$DIST" DATABASE_URL="$DB" setsid nohup bunx next dev -p "$PORT" > /tmp/battery-server.log 2>&1 < /dev/null &


echo "== waiting for server =="
for i in $(seq 1 60); do
  if curl -sf "$BASE/api/version" > /dev/null 2>&1; then break; fi
  [ "$i" = "60" ] && { echo "server never came up"; tail -20 /tmp/battery-server.log; exit 1; }
  sleep 2
done
echo "== server up =="

# The battery process talks to the SAME throwaway db (its direct prisma seeds
# and the portability restore must hit the isolated stack, not custom.db).
DATABASE_URL="$DB" BATTERY_BASE="$BASE" bun scripts/test-api-battery.ts
BATTERY_EXIT=$?
# (bun propagates the script's process.exit code; set -e handles failure.)

cleanup
echo "== isolated battery done (exit $BATTERY_EXIT); real db untouched =="
