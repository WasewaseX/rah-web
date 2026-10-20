#!/usr/bin/env bash
# Watchdog: every 15 seconds, check the site; if it is down, bring it back.
# Run detached at all times:  nohup bash scripts/watchdog.sh >/dev/null 2>&1 &
cd /home/z/my-project || exit 1

# Task 60: hourly learner-data sync to the git-tracked snapshot (240 ticks * 15s).
# The workspace is reprovisioned from git on update waves - the gitignored live
# DB dies with it (the Oct-20 wipe). The snapshot is the survival copy.
TICK=0

while true; do
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
    : # healthy, say nothing
  else
    echo "$(date -Is) watchdog: site DOWN, reviving" >> watchdog.log
    bash scripts/ensure-server.sh >> watchdog.log 2>&1
    echo "$(date -Is) watchdog: revive finished" >> watchdog.log
  fi
  sleep 15
  TICK=$((TICK + 1))
  if [ $((TICK % 240)) -eq 0 ] && [ -f db/custom.db ]; then
    echo "$(date -Is) watchdog: hourly db-sync" >> watchdog.log
    bash scripts/db-sync.sh >> watchdog.log 2>&1 || true
  fi
done
