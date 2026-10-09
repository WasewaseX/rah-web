#!/usr/bin/env bash
# Idempotent guard: makes sure the Rah site answers on :3000.
# Healthy -> exit 0 silently. Dead -> kill stragglers, restart, wait for health.
cd /home/z/my-project || exit 1

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
