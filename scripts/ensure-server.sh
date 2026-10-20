#!/usr/bin/env bash
# Idempotent guard: makes sure the Rah site answers on :3000.
# Healthy -> exit 0 silently. Dead -> kill stragglers, restart, wait for health.
cd /home/z/my-project || exit 1

# Disaster restore (Task 60): if the live learner DB vanished (workspace
# reprovision = fresh clone, the gitignored db/ dies with it), restore from
# the git-tracked snapshot BEFORE reviving - never boot into an empty learner.
if [ ! -f db/custom.db ] && [ -f db/sync/rah-latest.db ]; then
  echo "$(date -Is) db/custom.db missing - restoring learner data from db/sync/rah-latest.db"
  cp -a db/sync/rah-latest.db db/custom.db
  rm -f db/custom.db-wal db/custom.db-shm
  bun run db:push >> dev.log 2>&1 || true
fi

if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
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
    exit 0
  fi
done

echo "$(date -Is) FAILED to revive server"
exit 1
