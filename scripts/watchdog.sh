#!/usr/bin/env bash
# Watchdog: every 15 seconds, check the site; if it is down, bring it back.
# Run detached at all times:  nohup bash scripts/watchdog.sh >/dev/null 2>&1 &
# (ensure-server.sh and ensure-watchdog.sh self-start it after rebuilds.)
# DATA SURVIVAL: at most once per 24h, snapshot the learner DB and, if the
# content changed, commit + push it - so even stretches with no deploys lose
# at most a day of progress. Push failures are logged, never fatal.
cd /home/z/my-project || exit 1

LAST_TS_FILE="backups/.last-autosnap"

while true; do
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
    :
  else
    echo "$(date -Is) watchdog: site DOWN, reviving" >> watchdog.log
    bash scripts/ensure-server.sh >> watchdog.log 2>&1
    echo "$(date -Is) watchdog: revive finished" >> watchdog.log
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
        git commit -q -m "data: daily learner snapshot $(date -u +%F)" && git push origin HEAD -q && echo "daily snapshot pushed" || echo "(daily snapshot commit ok, push skipped/failed)"
      else
        echo "daily snapshot: no content change since last push"
      fi
    } >> watchdog.log 2>&1
  fi

  sleep 15
done
