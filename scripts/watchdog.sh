#!/usr/bin/env bash
# Watchdog: every 15 seconds, check the site; if it is down, bring it back.
# Run detached at all times:  nohup bash scripts/watchdog.sh >/dev/null 2>&1 &
# (ensure-server.sh and ensure-watchdog.sh self-start it after rebuilds.)
#
# DATA SURVIVAL (Task 60/61): two content-aware snapshot writers.
#  - HOURLY: scripts/db-sync.sh refreshes db/sync/rah-latest.db and commits it
#    ([skip ci]) - the freshest survival copy for a surprise reprovision.
#  - DAILY: scripts/db-snapshot.sh appends a timestamped history snapshot in
#    tracked backups/ and pushes it - bounds the loss window even across
#    long stretches with no deploys. Push failures are logged, never fatal.
cd /home/z/my-project || exit 1

TICK=0
LAST_TS_FILE="backups/.last-autosnap"

while true; do
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
    :
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

  now=$(date +%s)
  last=$([ -f "$LAST_TS_FILE" ] && cat "$LAST_TS_FILE" 2>/dev/null || echo 0)
  if [ "$((now - last))" -ge 86400 ]; then
    echo "$now" > "$LAST_TS_FILE" 2>/dev/null || true
    {
      echo "$(date -Is) watchdog: daily data snapshot"
      bash scripts/db-snapshot.sh
      if git status --porcelain -- backups 2>/dev/null | grep -q .; then
        git add backups
        git commit -q -m "data: daily learner history snapshot $(date -u +%F) [skip ci]" && git push origin HEAD -q && echo "daily history snapshot pushed" || echo "(daily history commit ok, push skipped/failed)"
      else
        echo "daily history snapshot: no content change since last push"
      fi
    } >> watchdog.log 2>&1
  fi
done
