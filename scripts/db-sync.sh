#!/usr/bin/env bash
# Sync the learner database to a GIT-TRACKED snapshot (db/sync/rah-latest.db)
# so it survives workspace reprovisioning - the actual wipe mechanism behind
# the Oct-20 incident: the preview serves THIS workspace, the live DB is a
# gitignored file, and an update wave that rebuilds the workspace starts from
# a fresh clone -> no db/custom.db -> empty learner -> "First Words" again.
# The git repo is the only durable store that provably survives (the roadmap,
# tasks and code all live there). Snapshot cadence: every deploy, hourly via
# the watchdog, and manually via this script.
#
# Sensitive runtime tables (Session tokens, LoginCode hashes) are SCRUBBED
# from the snapshot: learning progress restores perfectly, credentials never
# land in git history.
#
# Usage:  bash scripts/db-sync.sh [--no-git]
#   --no-git   only refresh the snapshot file (used by tests)
set -euo pipefail
cd "$(dirname "$0")/.."

LIVE_DB="${RAH_DB_PATH:-db/custom.db}"
SNAP="db/sync/rah-latest.db"
NO_GIT="${1:-}"

if [ ! -f "$LIVE_DB" ]; then
  echo "db-sync: $LIVE_DB does not exist - nothing to sync"
  exit 0
fi

mkdir -p db/sync
RAH_DB_PATH="$LIVE_DB" python3 - <<'PY'
import os, sqlite3
src = sqlite3.connect(os.environ["RAH_DB_PATH"])
con = sqlite3.connect("db/sync/rah-latest.db")
src.backup(con)  # consistent online backup - safe while the server writes
# scrub credential tables: the snapshot restores PROGRESS, never sessions
for t in ("Session", "LoginCode"):
    try:
        con.execute(f"DELETE FROM {t}")
    except Exception:
        pass  # table absent in older schemas
con.commit()
con.close()
src.close()
PY

if [ "$NO_GIT" = "--no-git" ]; then
  echo "db-sync: snapshot refreshed -> $SNAP (git skipped)"
  exit 0
fi

git add "$SNAP"
if git diff --cached --quiet -- "$SNAP"; then
  echo "db-sync: no learner-data changes since the last snapshot"
  exit 0
fi
git -c user.name="rah-db-sync" -c user.email="db-sync@rah.local" \
  commit -q -m "db-sync: learner data snapshot $(date -u +%Y%m%d-%H%M%S) [skip ci]" -- "$SNAP"
git push origin HEAD -q 2>/dev/null || echo "db-sync: push failed (offline?) - snapshot committed locally"
echo "db-sync: learner data committed to git -> $SNAP"
