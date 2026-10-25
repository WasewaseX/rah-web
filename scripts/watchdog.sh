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
LAST_PILOT_FILE="backups/.last-pilot-week"

while true; do
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
    :
  else
    echo "$(date -Is) watchdog: site DOWN, reviving" >> watchdog.log
    # Task 95 (review P1 #10): downtime is an EVENT in the alert log, not a
    # line only watchdog.log readers would ever see.
    bash scripts/alert.sh CRITICAL watchdog "site DOWN - reviving via ensure-server.sh"
    bash scripts/ensure-server.sh >> watchdog.log 2>&1
    echo "$(date -Is) watchdog: revive finished" >> watchdog.log
    bash scripts/alert.sh INFO watchdog "site revived after DOWN"
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
      # Task 97: PG survival dump FIRST (the live store post-flip) - the sidecar
      # counts JSON feeds freshness-check's PG branch, and the -latest copy in
      # upload/rah-backups is the recycle-restore artifact.
      bash scripts/pg-survival.sh dump || bash scripts/alert.sh CRITICAL pg-survival "daily PG dump failed - offsite PG copy stale"
      # Task 86: daily scheduling-loss check (insert-only repair; a no-op on
      # a healthy DB) before snapshotting so the offsite copies stay whole.
      # Task 95: a non-no-op repair is an alert (review P1 #10 - data-integrity
      # failures must surface, not hide in watchdog.log).
      repair_out=$(bash scripts/db-integrity-repair.sh 2>&1) || true
      if printf '%s' "$repair_out" | grep -q "REPAIRED"; then
        bash scripts/alert.sh WARN db-integrity "scheduling-loss repair fired: $(printf '%s' "$repair_out" | grep REPAIRED | head -2 | tr '\n' ' ' | cut -c1-200)"
      fi
      bash scripts/db-snapshot.sh
      # Task 92-bis: the WEEKLY pilot checkpoint, automated. The protocol's one
      # manual step (run pilot-metrics once per week, append verbatim to the
      # local series log) now happens on the watchdog's own cadence - the
      # series can no longer rot waiting for a human to remember. Zero-AI,
      # read-only; the series file lives in gitignored db/pilot/ (REG-2).
      # Task 95 ordering fix: this runs BEFORE vault-sync so a fresh weekly
      # checkpoint ships offsite in the SAME daily run (the old order made it
      # wait ~24h in local-only state - exactly the window recycles destroy).
      mkdir -p db/pilot
      pilot_now=$(date +%s)
      pilot_last=$([ -f "$LAST_PILOT_FILE" ] && cat "$LAST_PILOT_FILE" 2>/dev/null || echo 0)
      if [ "$((pilot_now - pilot_last))" -ge 604800 ]; then
        echo "$pilot_now" > "$LAST_PILOT_FILE" 2>/dev/null || true
        {
          echo ""
          echo "## Weekly checkpoint (watchdog-automated) — $(date -u +%Y-%m-%d)"
          node scripts/pilot-metrics.mjs
        } >> db/pilot/series.md 2>&1
        echo "$(date -Is) watchdog: weekly pilot checkpoint appended to db/pilot/series.md"
      fi
      # REG-2: the public repo never sees learner data - offsite = private vault
      # Task 95: vault-sync also RESTORES db/pilot/series.md after a recycle
      # (review P0 #4) and SHIPS the checkpoint appended above.
      bash scripts/vault-sync.sh || bash scripts/alert.sh CRITICAL vault-sync "daily vault push failed - offsite copy stale"
      # Task 97: weekly PG restore drill - prove the latest dump actually
      # restores with matching counts (the SQLite disaster-drill doctrine,
      # ported to the PG era).
      if [ "$((now / 604800))" != "$(cat /home/z/.pg-drill-week 2>/dev/null || echo 0)" ]; then
        echo "$((now / 604800))" > /home/z/.pg-drill-week 2>/dev/null || true
        bash scripts/pg-survival.sh verify || true
      fi
      # Task 90: durable SQLite maintenance - refresh planner stats (stat1 was
      # EMPTY until this ran once; the 0010 composite indexes need it to win
      # skewed plans) + bound the WAL file after heavy days.
      bash scripts/db-optimize.sh || true
      # Task 95 (review P1 #10): daily freshness-chain check - LIVE==SYNC==
      # VAULT==UPLOAD plus the Session/LoginCode scrub assertion. A mismatch
      # here means the restore/backup chain is silently diverging.
      if out=$(python3 scripts/freshness-check.py 2>&1); then :; else
        bash scripts/alert.sh CRITICAL freshness "freshness chain mismatch: $(printf '%s' "$out" | tail -3 | tr '\n' ' ' | cut -c1-200)"
      fi
      # Task 95 (review P1 #5): daily deployment drift check.
      bash scripts/deploy-drift-check.sh || true
      # Task 88: daily privacy sweep - dangling pre-scrub objects on the public
      # repo stay EVIDENCED, not forgotten. exit 1 = the GitHub Support purge
      # is still pending (the one remaining human action of the incident).
      # Task 95 (review P1 #10): a STATE CHANGE in the sweep (dangling count
      # moves, blob flips served/gone, or the day it returns CLEAN) is an
      # alert - the day the purge lands must be impossible to miss.
      if bash scripts/privacy-sweep-watchdog.sh >> db/privacy-sweep.log 2>&1; then
        echo "$(date -Is) watchdog: privacy sweep CLEAN (purge request can be closed)"
      else
        echo "$(date -Is) watchdog: privacy sweep -> dangling objects STILL served; Support purge still pending"
      fi
      sweep_state="$(grep -o 'RESULT: [0-9]* dangling[^|]*| blob-still-served=[01]' db/privacy-sweep.log 2>/dev/null | tail -1)"
      sweep_prev="$(cat db/.sweep-state 2>/dev/null || echo "")"
      if [ -n "$sweep_state" ] && [ "$sweep_state" != "$sweep_prev" ]; then
        echo "$sweep_state" > db/.sweep-state 2>/dev/null || true
        case "$sweep_state" in
          *"0 dangling"*"blob-still-served=0"*) bash scripts/alert.sh INFO privacy "purge CLOSED - sweep clean ($sweep_state)" ;;
          *) bash scripts/alert.sh WARN privacy "sweep state changed: $sweep_state" ;;
        esac
      fi
    } >> watchdog.log 2>&1
  fi
done
