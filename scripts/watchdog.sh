#!/usr/bin/env bash
# Watchdog: every 15 seconds, check the site; if it is down, bring it back.
# Run detached at all times:  nohup bash scripts/watchdog.sh >/dev/null 2>&1 &
# (ensure-server.sh and ensure-watchdog.sh self-start it after rebuilds.)
#
# DATA SURVIVAL (Task 60/61, retargeted by REG-2/Task 62): snapshot writers.
#  - HOURLY: scripts/db-sync.sh refreshes db/sync/rah-latest.db (gitignored
#    local restore source) and pushes it to the PRIVATE vault repo.
#  - DAILY: scripts/db-snapshot.sh appends a timestamped history snapshot in
#    gitignored backups/ (bounds the loss window), and vault-sync ships it to
#    the private vault. The PUBLIC repo never receives learner data (REG-2).
#    Push failures are logged, never fatal.
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
      # Task 86: daily scheduling-loss check (insert-only repair; a no-op on
      # a healthy DB) before snapshotting so the offsite copies stay whole.
      bash scripts/db-integrity-repair.sh
      bash scripts/db-snapshot.sh
      # REG-2: the public repo never sees learner data - offsite = private vault
      bash scripts/vault-sync.sh
      # Task 88: daily privacy sweep - dangling pre-scrub objects on the public
      # repo stay EVIDENCED, not forgotten. exit 1 = the GitHub Support purge
      # is still pending (the one remaining human action of the incident).
      if bash scripts/privacy-sweep-watchdog.sh >> db/privacy-sweep.log 2>&1; then
        echo "$(date -Is) watchdog: privacy sweep CLEAN (purge request can be closed)"
      else
        echo "$(date -Is) watchdog: privacy sweep -> dangling objects STILL served; Support purge still pending"
      fi
    } >> watchdog.log 2>&1
  fi
done
