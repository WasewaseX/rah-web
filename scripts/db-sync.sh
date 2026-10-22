#!/usr/bin/env bash
# Refresh the LOCAL learner-data snapshot (db/sync/rah-latest.db) and ship it
# to the PRIVATE vault repo via scripts/vault-sync.sh (folder rah-web/).
#
# REG-2 (2026-10-22): this script used to commit the snapshot to the PUBLIC
# repo - that leaked the learner's email, progress and chats, and is the
# reason this file exists in its current form. Doctrine now:
#   - db/sync/rah-latest.db  = LOCAL freshest restore source (gitignored,
#     survives only same-volume incidents; read by db-guard.sh at boot)
#   - vault repo rah-web/    = the ONLY offsite copy (private, access-controlled)
#   - the public repo        = ZERO learner data, forever
# Sensitive runtime tables (Session tokens, LoginCode hashes) are scrubbed
# from every snapshot: restores bring PROGRESS back, never credentials.
#
# Usage:  bash scripts/db-sync.sh [--no-git]
#   --no-git   only refresh the local snapshot file, no vault push (tests)
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
RAH_DB_PATH="$LIVE_DB" python3 - "$SNAP" <<'PY'
import os, sqlite3, sys
src = sqlite3.connect(os.environ["RAH_DB_PATH"])
con = sqlite3.connect(sys.argv[1])
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
echo "db-sync: local snapshot refreshed -> $SNAP (gitignored; offsite = private vault)"

# Freshest copy onto the rebuild-proof OSS mount (REG-1 lesson, Task 63): a
# workspace reprovision is a fresh clone - db/sync dies with it, and the
# guard's dated OSS snapshots can lag by hours. This fixed-name copy is what
# db-guard restores from FIRST at boot, so a post-rebuild boot is at most one
# sync interval behind instead of one boot-to-boot gap.
OSS_DIR="upload/rah-backups"
if [ -d "$OSS_DIR" ] || mkdir -p "$OSS_DIR" 2>/dev/null; then
  cp -f "$SNAP" "$OSS_DIR/rah-latest.db.tmp" && mv -f "$OSS_DIR/rah-latest.db.tmp" "$OSS_DIR/rah-latest.db" \
    && echo "db-sync: freshest copy staged -> $OSS_DIR/rah-latest.db (survives rebuilds)"
fi

if [ "$NO_GIT" = "--no-git" ]; then
  echo "db-sync: --no-git - local snapshot only, vault push skipped"
  exit 0
fi

# Offsite copy goes to the PRIVATE vault repo only (asserted inside).
bash scripts/vault-sync.sh || echo "db-sync: WARNING - vault push failed (offline?); local snapshot is current"
