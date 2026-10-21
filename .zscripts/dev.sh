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

# DATA GUARD (2026-10-21 REG-1, hardened 2026-10-22 REG-2): a workspace-
# rebuilding update erased the untracked custom.db and db:push silently
# recreated it EMPTY. The guard runs FIRST (needs only bash+python3, before
# even bun install) and:
#   - restores the newest VERIFIED backup when the live DB is missing or
#     shows no real usage. Sources, in order: upload/rah-backups/ (the OSS
#     mount that survives workspace replacement), db/backups/, and the
#     db-sync snapshot db/sync/rah-latest.db (now gitignored - REG-2 moved
#     all learner data out of the PUBLIC repo into the private vault).
#   - snapshots the live DB BEFORE db:push can touch it when it holds data.
echo "[rah-dev] boot: data guard (restore-if-fresh / snapshot-if-used)"
bash scripts/db-guard.sh boot 2>&1 | tee -a dev.log

echo "[rah-dev] boot: installing dependencies"
bun install >> dev.log 2>&1
echo "[rah-dev] boot: syncing database schema"
bun run db:push >> dev.log 2>&1 || true

# Schema-restore guard (2026-10-10 incident): a platform volume restore rolled
# custom.db back to an old schema, db:push failed silently (`|| true`), and the
# site served 500s for hours because the MistakeFamily table was missing. The
# boot now PROBES a canary table that exists in the current schema and, if the
# probe fails, retries db:push loudly (3 attempts) instead of trusting it.
CANARY="MistakeFamily"
probe_db() {
  bun -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$CANARY.count().then(c=>{console.log('canary-ok:'+c);process.exit(0)}).catch(e=>{console.log('canary-fail:'+e.code);process.exit(1)})" >/dev/null 2>&1
}

# Restore guard must fire on EVERY (re)start, not only platform boot: a
# reprovision can wipe db/ while this supervisor is alive, and the next
# restart would otherwise db:push an empty learner back into existence.
restore_db() {
  if [ ! -f db/custom.db ]; then
    echo "[rah-dev] $(date -Is) db/custom.db missing - running data guard restore" >> dev.log
    bash scripts/db-guard.sh boot >> dev.log 2>&1
  fi
}
restore_db

for attempt in 1 2 3; do
  if probe_db; then
    echo "[rah-dev] boot: schema probe OK ($CANARY reachable)" >> dev.log
    break
  fi
  echo "[rah-dev] boot: schema probe FAILED (attempt $attempt) - re-running db:push" >> dev.log
  bun run db:push >> dev.log 2>&1
  sleep 2
done

FAILS=0
while true; do
  # Clear anything squatting on the port from a previous generation.
  restore_db
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
    # Daily data snapshot while the server runs (stamp-guarded inside the
    # guard; a long-lived container must not depend on reboots for backups).
    bash scripts/db-guard.sh daily >> dev.log 2>&1 || true
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
