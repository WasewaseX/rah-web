#!/usr/bin/env bash
# Rah self-healing dev supervisor.
# Executed by the platform at every boot (/start.sh runs .zscripts/dev.sh as
# user z, in a platform-owned process). The historic failure mode was:
# start.sh launched `bun run dev` once with no supervision, so a crashed or
# hung dev server stayed dead until a full sandbox reboot. This script makes
# the site process self-healing: restart on exit, restart on 60s of failed
# health checks, and clean up stale next-server processes holding the port.
cd /home/z/my-project || exit 1

export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export TELEMETRY_DISABLED=1

echo "[rah-dev] boot: installing dependencies"
bun install >> dev.log 2>&1
echo "[rah-dev] boot: syncing database schema"
bun run db:push >> dev.log 2>&1 || true

FAILS=0
while true; do
  # Clear anything squatting on the port from a previous generation.
  pkill -f "next-server" 2>/dev/null
  pkill -f "next dev -p 3000" 2>/dev/null
  sleep 1

  echo "[rah-dev] $(date -Is) starting dev server" >> dev.log
  bun run dev >> dev.log 2>&1 &
  SERVER_PID=$!

  # Supervise: restart when the process exits OR when health checks fail
  # for 4 consecutive ticks (60s) - covers hangs as well as crashes.
  FAILS=0
  while kill -0 "$SERVER_PID" 2>/dev/null; do
    sleep 15
    if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
      FAILS=0
    else
      FAILS=$((FAILS + 1))
      if [ "$FAILS" -ge 4 ]; then
        echo "[rah-dev] $(date -Is) unhealthy for 60s; restarting" >> dev.log
        kill "$SERVER_PID" 2>/dev/null
        break
      fi
    fi
  done

  wait "$SERVER_PID" 2>/dev/null
  echo "[rah-dev] $(date -Is) dev server exited; restarting in 3s" >> dev.log
  sleep 3
done
