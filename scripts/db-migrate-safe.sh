#!/usr/bin/env bash
# Versioned migrations, safely. Replaces a bare `prisma migrate deploy`:
#   1. Clean deploy when there is nothing unusual (the common case).
#   2. On P3005 (schema exists, no migration history - happens when a restore
#      predates the history table or bootstrap used db push), baseline by
#      resolving every existing migration as applied, then deploy again.
# NEVER `migrate reset`, NEVER `db push --accept-data-loss` - those are how
# learner data dies. This script may only move the schema FORWARD.
set -u
# Task 87-d: GUARD_ROOT-aware (same convention as db-guard.sh) - the hardcoded
# cd made clone-scoped drills and non-canonical deployment paths impossible.
ROOT="${GUARD_ROOT:-/home/z/my-project}"
cd "$ROOT" || exit 1

if bun run db:deploy > /tmp/db-migrate.log 2>&1; then
  echo "migrate: clean deploy (no pending or all applied)"
  exit 0
fi

if grep -q "P3005" /tmp/db-migrate.log; then
  echo "migrate: schema without history (P3005) - baselining existing migrations"
  for dir in prisma/migrations/[0-9]*/; do
    name=$(basename "$dir")
    if bunx prisma migrate resolve --applied "$name" >> /tmp/db-migrate.log 2>&1; then
      echo "migrate: resolved $name as applied"
    else
      echo "migrate: resolve FAILED for $name (see /tmp/db-migrate.log)"
      tail -5 /tmp/db-migrate.log
      exit 1
    fi
  done
  if bun run db:deploy >> /tmp/db-migrate.log 2>&1; then
    echo "migrate: deploy after baseline OK"
    exit 0
  fi
  echo "migrate: deploy after baseline FAILED (see /tmp/db-migrate.log)"
  tail -5 /tmp/db-migrate.log
  exit 1
fi

echo "migrate: FAILED (see /tmp/db-migrate.log)"
tail -5 /tmp/db-migrate.log
exit 1
