#!/usr/bin/env bash
# DATA SURVIVAL - restore side. On a fresh environment rebuild the live DB is
# GONE (db/custom.db is gitignored runtime data). If a git-tracked snapshot
# exists, rebuild the learner DB from the newest one; versioned migrations
# (run right after by ensure-server.sh) then bring the schema forward.
# Never touches an existing live DB - restore only fills a hole.
set -u
cd /home/z/my-project || exit 1

DB="db/custom.db"

[ -s "$DB" ] && exit 0  # live db present; nothing to restore

LATEST=$(ls -1t backups/rah-*.sqlite.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "restore: no live db and no snapshots; genuinely first boot"
  exit 0
fi

rm -f "$DB-journal" "$DB-wal" "$DB-shm"
gunzip -c "$LATEST" > "$DB" || { echo "restore: gunzip FAILED"; rm -f "$DB"; exit 1; }
echo "restore: $(basename "$LATEST") -> $DB ($(du -h "$DB" | cut -f1))"
exit 0
