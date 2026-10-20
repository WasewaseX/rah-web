#!/usr/bin/env bash
# FIRST ACTION OF EVERY WORKING SESSION (the stale-reprovision lesson, Task 61):
# a workspace can come back from an update wave pinned to a STALE ref - proven
# twice on Oct-20 (the second wipe booted a pre-fix tree, bypassing the
# restore-on-boot layer). Syncing to the newest remote BEFORE any server boots
# guarantees the tree has (a) the newest survival scripts and (b) the newest
# learner-data snapshots, which db-restore.sh then uses.
#   bash scripts/session-start.sh
set -uo pipefail
cd /home/z/my-project || exit 1

echo "== session start: sync workspace to newest remote"
git fetch origin 2>&1 | tail -1
BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
if [ "$BEHIND" != "0" ]; then
  STASHED=0
  git stash -u > /dev/null 2>&1 && STASHED=1
  if git merge --ff-only origin/main > /dev/null 2>&1; then
    echo "synced: HEAD was $BEHIND commit(s) behind; fast-forwarded to $(git rev-parse --short=12 HEAD)"
  else
    echo "fast-forward refused (local divergence); attempting rebase merge"
    git merge origin/main --no-edit || echo "(merge needs manual conflict resolution - resolve, then rerun)"
  fi
  [ "$STASHED" = "1" ] && git stash pop > /dev/null 2>&1 || true
else
  echo "already current: $(git rev-parse --short=12 HEAD)"
fi

echo "== session start: boot guard (restore-if-missing + migrate-safe + health)"
bash scripts/ensure-server.sh
