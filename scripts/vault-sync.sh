#!/usr/bin/env bash
# REG-2 (Task 62): the ONLY sanctioned path for learner data to leave this
# workspace offsite. Pushes snapshots to the PRIVATE vault repo
# (github.com/WasewaseX/vault), folder rah-web/ - per the learner's
# instruction "simply save the data at the private vault repo make a new
# folder". The PUBLIC repo (rah-web) must NEVER receive learner data again:
#   - this script asserts the target remote URL is the vault repo, and
#     aborts if it resolves to anything containing "rah-web" (the public
#     repo) - belt and braces against misconfiguration;
#   - no script in this repo may `git push` learner snapshots anywhere but
#     here (deploy.sh / watchdog.sh / db-sync.sh all route through this).
#
# What it ships:
#   rah-web/rah-latest.db          - newest snapshot (Session/LoginCode scrubbed)
#   rah-web/history/rah-<UTC>.db   - dated history, newest $VAULT_KEEP kept
#
# Snapshots already exist? It ships them (pure transport). Missing? It makes
# the freshest one from the live DB first (same scrub as db-sync.sh).
#
# Usage:  bash scripts/vault-sync.sh
# Env:    VAULT_DIR (default db/vault-work, gitignored)
#         VAULT_KEEP (default 30)
#         VAULT_URL (override; default derived from this repo's origin URL
#                    by swapping rah-web.git -> vault.git, so a rotated PAT
#                    propagates without any secret stored in tracked files)
set -u
cd "$(dirname "$0")/.."

VAULT_DIR="${VAULT_DIR:-db/vault-work}"
VAULT_KEEP="${VAULT_KEEP:-30}"
VAULT_FOLDER="rah-web"
LIVE_DB="${RAH_DB_PATH:-db/custom.db}"
LOCAL_SNAP="db/sync/rah-latest.db"
LOG="db/vault-sync.log"

log() { echo "[vault-sync] $(date -Is) $*" >> "$LOG"; echo "[vault-sync] $*"; }

# ---- resolve + assert the target remote (the safety core) ------------------
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo "")"
VAULT_URL="${VAULT_URL:-$(printf '%s' "$ORIGIN_URL" | sed -e 's#/rah-web\.git#/vault.git#' -e 's#/rah-web$#/vault#')}"
case "$VAULT_URL" in
  *WasewaseX/vault*) : ;;
  *) log "ABORT: derived vault URL is not the private vault repo: '$VAULT_URL'"; exit 1 ;;
esac
case "$VAULT_URL" in
  *rah-web*) log "ABORT: target looks like the PUBLIC repo - refusing"; exit 1 ;;
esac

# ---- refresh the working clone ---------------------------------------------
if [ -d "$VAULT_DIR/.git" ]; then
  git -C "$VAULT_DIR" remote set-url origin "$VAULT_URL" 2>>"$LOG" || true
  if ! git -C "$VAULT_DIR" pull --ff-only -q origin main 2>>"$LOG"; then
    log "WARNING: vault pull failed (offline or diverged) - continuing on the local clone"
  fi
else
  mkdir -p "$(dirname "$VAULT_DIR")"
  if ! git clone -q "$VAULT_URL" "$VAULT_DIR" 2>>"$LOG"; then
    log "ERROR: could not clone the vault repo - offsite sync skipped"
    exit 1
  fi
fi
git -C "$VAULT_DIR" config user.name  "rah-vault-sync" 2>/dev/null || true
git -C "$VAULT_DIR" config user.email "vault-sync@rah.local" 2>/dev/null || true

# re-assert on the actual clone (guards a pre-existing misconfigured clone)
CLONE_URL="$(git -C "$VAULT_DIR" remote get-url origin 2>/dev/null || echo "")"
case "$CLONE_URL" in
  *WasewaseX/vault*) : ;;
  *) log "ABORT: vault clone remote is '$CLONE_URL' - not the private vault"; exit 1 ;;
esac

DEST="$VAULT_DIR/$VAULT_FOLDER"
mkdir -p "$DEST/history"

# ---- freshest snapshot: make it if absent, ship it always -------------------
if [ ! -s "$LOCAL_SNAP" ] && [ -s "$LIVE_DB" ]; then
  mkdir -p db/sync
  RAH_DB_PATH="$LIVE_DB" python3 - "$LOCAL_SNAP" <<'PY'
import os, sqlite3, sys
src = sqlite3.connect(os.environ["RAH_DB_PATH"])
con = sqlite3.connect(sys.argv[1])
src.backup(con)  # consistent online backup - safe while the server writes
for t in ("Session", "LoginCode"):
    try:
        con.execute(f"DELETE FROM {t}")
    except Exception:
        pass  # table absent in older schemas
con.commit(); con.close(); src.close()
PY
  log "made fresh scrubbed snapshot -> $LOCAL_SNAP"
fi
if [ -s "$LOCAL_SNAP" ]; then
  cp -f "$LOCAL_SNAP" "$DEST/rah-latest.db"
fi

# ---- dated history: ship any gzip snapshot not yet in the vault -------------
for gz in backups/rah-*.sqlite.gz; do
  [ -e "$gz" ] || break
  base="$(basename "$gz" .sqlite.gz)"          # rah-20261021T214500Z
  target="$DEST/history/$base.db"
  if [ ! -s "$target" ]; then
    gunzip -c "$gz" > "$target" || { log "WARNING: could not unpack $gz - skipped"; rm -f "$target"; }
  fi
done

# ---- rotate: keep the newest $VAULT_KEEP dated snapshots --------------------
ls -1 "$DEST/history"/rah-*.db 2>/dev/null | sort -r | tail -n +$((VAULT_KEEP + 1)) | while read -r old; do
  rm -f "$old"; log "pruned old vault snapshot $(basename "$old")"
done

# ---- commit + push (only when content changed) ------------------------------
if git -C "$VAULT_DIR" status --porcelain -- "$VAULT_FOLDER" | grep -q .; then
  git -C "$VAULT_DIR" add "$VAULT_FOLDER"
  git -C "$VAULT_DIR" commit -q -m "rah-web: learner data snapshot $(date -u +%Y%m%d-%H%M%S)" -- "$VAULT_FOLDER"
  if git -C "$VAULT_DIR" push -q origin HEAD 2>>"$LOG"; then
    log "pushed learner snapshots to PRIVATE vault ($VAULT_FOLDER/)"
  else
    log "ERROR: vault push failed (offline?) - committed locally in $VAULT_DIR"
    exit 1
  fi
else
  log "vault already up to date - nothing to push"
fi
