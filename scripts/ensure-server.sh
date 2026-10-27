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

# Task 98: same doctrine as dev-or-prod.sh - the gitignored .env must win
# over platform-inherited env on EVERY boot road (prod, dev fallback, and
# the supervisor's own bun run dev entry). Without this, a stale exported
# DATABASE_URL from the reprovisioned session env silently reverts a
# PostgreSQL-era tree to SQLite.
#
# Task 99: .env SURVIVAL. Recycle #9 (the day after Task 98) reset .env to
# the platform's 50-byte SQLite default AGAIN - the silent PG revert class.
# Guard: if .env is missing or non-PG while the preserved copy on the
# proven-surviving upload mount says postgresql, restore it first (loud
# WARN - deliberate engine flips go through pg-cutover.sh, which rewrites
# both copies). Then source, then refresh the preserved copy.
ENV_BACKUP="upload/rah-backups/env-rah-latest"
if [ -f "$ENV_BACKUP" ] && grep -q '^DATABASE_URL=postgresql://' "$ENV_BACKUP" 2>/dev/null; then
  if [ ! -f .env ] || ! grep -q '^DATABASE_URL=postgresql://' .env 2>/dev/null; then
    echo "$(date -Is) .env missing or non-PG while the preserved copy says postgresql - restoring it (recycle signature)"
    cp "$ENV_BACKUP" .env && chmod 600 .env
    bash scripts/alert.sh WARN ensure-server ".env was reset by the workspace - restored the preserved PostgreSQL configuration" || true
  fi
fi
set -a; . ./.env 2>/dev/null; set +a
if grep -q '^DATABASE_URL=postgresql://' .env 2>/dev/null; then
  mkdir -p upload/rah-backups && cp .env "$ENV_BACKUP" && chmod 600 "$ENV_BACKUP"
fi

# CLIENT-SYNC GUARD (Task 87, the Oct-23 live incident): `prisma migrate deploy`
# applies SQL but NEVER regenerates the TS client. After any tree sync/reset,
# a generated client from an older schema boots silently and every query that
# uses a newer column 500s at runtime (Oct-23: CardState.userId unknown ->
# /api/state eternal loading + coach-agent dead). Stamp-based check: prisma
# rewrites the schema copy on generate (not byte-identical), so we record the
# source schema's hash in a stamp file after each generate; on boot a missing
# or mismatched stamp means the client predates the current schema -> regen.
# Never blocks boot: a failed regenerate falls through to the health check,
# which will fail loudly.
SCHEMA="prisma/schema.prisma"
STAMP="node_modules/.prisma/client/.rah-schema-stamp"
if [ -f "$SCHEMA" ] && [ -d node_modules/.prisma/client ]; then
  SRC_HASH="$(sha256sum "$SCHEMA" | cut -d' ' -f1)"
  if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP" 2>/dev/null)" != "$SRC_HASH" ]; then
    echo "$(date -Is) prisma client stale (schema stamp drift) - regenerating"
    if bunx prisma generate >> /tmp/prisma-generate.log 2>&1; then
      echo "$SRC_HASH" > "$STAMP"
    else
      echo "$(date -Is) WARNING: prisma generate failed - see /tmp/prisma-generate.log"
    fi
  fi
fi

bash scripts/db-guard.sh boot || true   # Task 86 wiring: snapshot-if-used BEFORE any schema work / restore-if-fresh
bash scripts/pg-survival.sh ensure || true  # Task 97: PG survival - start-or-restore BEFORE the app needs it (no-op when .env is SQLite)
bash scripts/db-restore.sh || true
bash scripts/db-migrate-safe.sh || echo "(migrate skipped/failed - see /tmp/db-migrate.log)"
# Task 86: scheduling-loss repair - a live-but-damaged DB (review history
# present, FSRS schedule rows gone) sails through restore-if-missing and the
# schema canary. Insert-only repair from the verified snapshot chain, BEFORE
# the server accepts writes. Never blocks boot.
bash scripts/db-integrity-repair.sh || true

if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
  # Task 95 (review P1 #5): "healthy" is not enough - it must be the INTENDED
  # release. Recycle #7's exact state: boot fell back to dev because .next/
  # was wiped, then build-prod.sh produced BUILD_ID, and the dev server kept
  # serving while every health check passed. If a dev server answers while a
  # prod build exists, flip it - kill and fall through to the prod boot below.
  if [ -s .next/BUILD_ID ] && pgrep -f "next dev" >/dev/null 2>&1; then
    echo "$(date -Is) healthy but DEV is serving while a prod build exists - flipping to the release build"
    pkill -f "next dev" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    pkill -f "standalone/server.js" 2>/dev/null
    sleep 2
  else
    bash scripts/db-snapshot.sh || true
    bash scripts/pg-survival.sh dump || true   # Task 99: shrink the PG snapshot window from daily to every boot
    bash scripts/db-sync.sh || true
    bash scripts/ensure-watchdog.sh || true
    bash scripts/deploy-drift-check.sh || true
    exit 0
  fi
fi

echo "$(date -Is) server down; reviving"
pkill -f "next dev -p 3000" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
sleep 2

# Task 99: ARTIFACT RESTORE - if the recycle wiped .next/BUILD_ID but the
# preserved build artifact exists, restore it instead of rebuilding in
# place (or worse, letting the boot fall back to dev). The tgz is verified
# against its sha256 manifest before it is trusted.
if [ ! -s .next/BUILD_ID ] && [ -f upload/rah-backups/rah-build-latest.tgz ]; then
  WANT_SHA=$(python3 -c "import json;print(json.load(open('upload/rah-backups/rah-build-latest.json'))['sha256'])" 2>/dev/null)
  GOT_SHA=$(sha256sum upload/rah-backups/rah-build-latest.tgz 2>/dev/null | cut -d' ' -f1)
  if [ -n "$WANT_SHA" ] && [ "$WANT_SHA" = "$GOT_SHA" ]; then
    echo "$(date -Is) BUILD_ID missing - restoring the preserved build artifact (sha256 verified)"
    rm -rf .next/standalone
    mkdir -p .next   # drill-proven: tar -C .next fails silently when the recycle removed .next/ entirely
    tar -xzf upload/rah-backups/rah-build-latest.tgz -C .next
    # The tar holds the standalone/ subtree; .next/BUILD_ID sits beside it,
    # so rebuild it from the manifest (drill-proven requirement - without it
    # the prod-boot condition fails and the road falls back to dev).
    python3 -c "import json;print(json.load(open('upload/rah-backups/rah-build-latest.json'))['build_id'])" > .next/BUILD_ID
    if [ ! -f .next/standalone/server.js ]; then
      echo "$(date -Is) WARNING: artifact restore did not produce standalone/server.js - rebuild path"
    else
      echo "$(date -Is) artifact restored: BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null)"
    fi
  else
    echo "$(date -Is) WARNING: artifact sha mismatch (want=${WANT_SHA:0:12} got=${GOT_SHA:0:12}) - skipping artifact restore"
    bash scripts/alert.sh WARN ensure-server "build artifact sha mismatch - falling back to rebuild path" || true
  fi
fi

# PRODUCTION BOOT (Task 89): the deployment ran `next dev` 24/7 - on-demand
# compilation, no minification, no response caching - while the repo already
# shipped a standalone build path (bun run build / standalone/server.js).
# When a verified production build exists, boot it; the health check below is
# the same gate either way, and a prod failure falls back to the dev boot
# LOUDLY (this log) so the learner is never left with a dead app.
booted=0
if [ "${RAH_PROD:-1}" != "0" ] && [ -f .next/standalone/server.js ] && [ -f .next/BUILD_ID ]; then
  set -a; . ./.env 2>/dev/null; set +a
  export NODE_ENV=production
  nohup node .next/standalone/server.js >> server.log 2>&1 &
  disown
  for _ in $(seq 1 10); do
    sleep 2
    if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
      echo "$(date -Is) server healthy (production standalone build)"
      booted=1
      break
    fi
  done
  if [ "$booted" = "0" ]; then
    echo "$(date -Is) production boot failed health check - falling back to dev"
    pkill -f "standalone/server.js" 2>/dev/null   # failed attempt: clear the port
    sleep 1
  fi
fi
if [ "$booted" = "0" ]; then
  nohup bun run dev >> dev.log 2>&1 &
  disown
fi

for _ in $(seq 1 30); do
  sleep 2
  if curl -sf -o /dev/null --max-time 5 http://localhost:3000/api/version; then
    echo "$(date -Is) server healthy again"
    bash scripts/db-snapshot.sh || true
    bash scripts/pg-survival.sh dump || true   # Task 99: every successful revive ships a fresh PG snapshot
    bash scripts/db-sync.sh || true
    bash scripts/ensure-watchdog.sh || true
    # Task 95 (review P1 #5): boot-time drift check - if what just came up
    # is not the intended release (e.g. dev fallback because the recycle
    # wiped .next/), the alert log records it instead of nobody noticing.
    bash scripts/deploy-drift-check.sh || true
    exit 0
  fi
done

echo "$(date -Is) FAILED to revive server"
exit 1
