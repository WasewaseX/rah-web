#!/usr/bin/env bash
# DATA SURVIVAL - restore side (Task 60/61). The workspace can be reprovisioned
# from git at any time (sometimes from a stale ref), and the gitignored live DB
# dies with it. Restore-if-missing ONLY - never touches an existing live DB.
# Source preference:
#   1. db/sync/rah-latest.db   - the hourly watchdog-synced snapshot (freshest)
#   2. backups/rah-*.sqlite.gz - timestamped history (deploy/daily cadence)
# Versioned migrations (db-migrate-safe.sh, run right after by ensure-server.sh)
# then bring the schema forward and record history (fixes the P3005 hole that
# a bare `db push` restore used to leave behind).
set -u
cd /home/z/my-project || exit 1

DB="db/custom.db"

[ -s "$DB" ] && exit 0  # live db present; nothing to restore

# 1) freshest: the git-tracked latest snapshot
if [ -s "db/sync/rah-latest.db" ]; then
  rm -f "$DB-journal" "$DB-wal" "$DB-shm"
  cp -a db/sync/rah-latest.db "$DB"
  echo "restore: db/sync/rah-latest.db -> $DB ($(du -h "$DB" | cut -f1))"
  exit 0
fi

# 2) fallback: newest timestamped history snapshot
LATEST=$(ls -1t backups/rah-*.sqlite.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "restore: no live db and no snapshots; genuinely first boot"
  exit 0
fi

rm -f "$DB-journal" "$DB-wal" "$DB-shm"
gunzip -c "$LATEST" > "$DB" || { echo "restore: gunzip FAILED"; rm -f "$DB"; exit 1; }
echo "restore: $(basename "$LATEST") -> $DB ($(du -h "$DB" | cut -f1))"
exit 0
