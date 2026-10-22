#!/usr/bin/env bash
# Task 69 companion: a dedicated throwaway stack for real mobile-browser
# testing (own DB, own port, open registration) - the learner's live DB is
# never touched by the browser pass.
set -euo pipefail
cd /home/z/my-project

PORT=3123
DB="file:/home/z/my-project/db/battery-mobile.db"
DIST=".next-mobile"
LOG=/tmp/mobile-server.log

# NOTE: no EXIT trap here - this script intentionally LEAVES the stack
# running for the browser pass (the trap killed its own server, Task 69).

export RAH_OPEN_REGISTRATION=1
rm -f db/battery-mobile.db db/battery-mobile.db-*
DATABASE_URL="$DB" bunx prisma db push --skip-generate > /dev/null 2>&1
echo "mobile-test db ready"

NEXT_DIST_DIR="$DIST" DATABASE_URL="$DB" setsid nohup bunx next dev -p "$PORT" > "$LOG" 2>&1 < /dev/null &
for i in $(seq 1 60); do
  curl -sf "http://localhost:$PORT/api/version" > /dev/null 2>&1 && break
  [ "$i" = 60 ] && { echo "server never came up"; tail -20 "$LOG"; exit 1; }
  sleep 2
done
echo "mobile-test server up on :$PORT"
echo "keep this stack running for the browser pass (pid $!)"
