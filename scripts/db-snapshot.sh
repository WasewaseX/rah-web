#!/usr/bin/env bash
# DATA SURVIVAL - snapshot side. (Root cause of the 2026-10-20 data loss:
# db/custom.db is runtime data and gitignored; only git-tracked files survive
# environment rebuilds. These snapshots ARE tracked, so the learner's history
# now rides every push.)
#
# Content-aware: hashes the consistent copy and skips when nothing changed
# since the newest snapshot, so calling this on every deploy/boot is cheap
# and commit churn stays zero while data is unchanged. Keeps the last 10.
set -u
cd /home/z/my-project || exit 1

DB="db/custom.db"
DIR="backups"
KEEP=10
mkdir -p "$DIR"

# Task 98: engine gate. This chain snapshots the LIVE store via Prisma +
# SQLite VACUUM INTO - it is only valid when the live store IS SQLite. In
# the PostgreSQL era (.env DATABASE_URL=postgresql://) the live snapshots
# are owned by pg-survival.sh dump (pg_dump -Fc + sidecar counts, Session/
# LoginCode rows excluded) and the SQLite rollback artifact db/custom.db is
# preserved verbatim by db-sync.sh + vault-sync file copies. A PG-connected
# client cannot open a file: URL and VACUUM INTO is not PG SQL (the boot
# after the Task 97 flip proved it: P2010, 42601 at "INTO") - so skip
# cleanly instead of failing every boot.
ENV_URL="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2-)"
case "$ENV_URL" in
  postgresql://*)
    echo "snapshot: live store is PostgreSQL - SQLite vacuum chain skipped (live snapshots = pg-survival.sh dump; artifact copies = db-sync.sh)"
    exit 0 ;;
esac

[ -s "$DB" ] || { echo "snapshot: no live db at $DB; nothing to do"; exit 0; }

TMP="$DIR/.vacuum-$$.sqlite"
OUT="$DIR/rah-$(date -u +%Y%m%dT%H%M%SZ).sqlite.gz"

# Consistent copy + hygiene (never let a failure kill the caller's flow)
if ! bun run scripts/db-snapshot-core.ts "$(cd "$DIR" && pwd)/.vacuum-$$.sqlite" > /tmp/db-snapshot-core.log 2>&1; then
  echo "snapshot: FAILED - see /tmp/db-snapshot-core.log"; rm -f "$TMP"; exit 1
fi
tail -1 /tmp/db-snapshot-core.log

RAW_SHA=$(sha256sum "$TMP" | cut -d' ' -f1)
LATEST=$(ls -1t "$DIR"/rah-*.sqlite.gz 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  OLD_SHA=$(gunzip -c "$LATEST" | sha256sum | cut -d' ' -f1)
  if [ "$RAW_SHA" = "$OLD_SHA" ]; then
    echo "snapshot: unchanged since $(basename "$LATEST"); skip"
    rm -f "$TMP"; exit 0
  fi
fi

gzip -9 -c "$TMP" > "$OUT" && rm -f "$TMP"
echo "snapshot: $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"

# Prune to the newest $KEEP snapshots (never delete the newest one)
ls -1t "$DIR"/rah-*.sqlite.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"; echo "snapshot: pruned $(basename "$old")"
done
exit 0
