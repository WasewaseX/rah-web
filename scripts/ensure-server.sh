#!/usr/bin/env bash
# Idempotent guard: makes sure the Rah site answers on :3000.
# Healthy -> exit 0 silently. Dead -> kill stragglers, restart, wait for health.
#
# DATA SURVIVAL (Task 60/61, the 2026-10-20 double wipe): the workspace can be
# reprovisioned from git at any moment (sometimes from a STALE ref - proven
# twice on Oct-20). The gitignored db/custom.db dies with it, so BEFORE the
# server boots: restore the learner DB (freshest db/sync snapshot first,
# timestamped backups/ history as fallback), then move the schema FORWARD with
# versioned migrations - never reset, never a blind db push. Once healthy:
# refresh both snapshot stores and keep the watchdog alive.
cd /home/z/my-project || exit 1

bash scripts/db-restore.sh || true
bash scripts/db-migrate-safe.sh || echo "(migrate skipped/failed - see /tmp/db-migrate.log)"

if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
  bash scripts/db-snapshot.sh || true
  bash scripts/db-sync.sh || true
  bash scripts/ensure-watchdog.sh || true
  exit 0
fi

echo "$(date -Is) server down; reviving"
pkill -f "next dev -p 3000" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 2
nohup bun run dev >> dev.log 2>&1 &
disown

for _ in $(seq 1 30); do
  sleep 2
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
    echo "$(date -Is) server healthy again"
    bash scripts/db-snapshot.sh || true
    bash scripts/db-sync.sh || true
    bash scripts/ensure-watchdog.sh || true
    exit 0
  fi
done

echo "$(date -Is) FAILED to revive server"
exit 1
