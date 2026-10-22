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
#         RAH_VAULT_ENC=1 -> encrypt every snapshot before it leaves the
#            workspace (AES-256-CBC, PBKDF2 200k). Key resolution:
#            RAH_VAULT_PASSPHRASE env, else the key file on the OSS mount
#            (upload/rah-backups/.vaultkey, auto-created 32-byte random on
#            first use - the mount survives workspace rebuilds, so the key
#            does too; honest tradeoff: key and backups share that mount).
#            When enabled the vault holds ONLY .enc files - plaintext never
#            leaves this machine. Restore: see decode_blob() at the bottom.
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

# ---- encryption (opt-in, closes the recorded open decision) ------------------
ENC=0
KEYFILE="upload/rah-backups/.vaultkey"
if [ "${RAH_VAULT_ENC:-0}" = "1" ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    log "ERROR: RAH_VAULT_ENC=1 but openssl is unavailable - aborting rather than shipping plaintext"
    exit 1
  fi
  ENC=1
  PASSARGS=""
  if [ -n "${RAH_VAULT_PASSPHRASE:-}" ]; then
    PASSARGS=("-pass" "env:RAH_VAULT_PASSPHRASE")
  else
    if [ ! -s "$KEYFILE" ]; then
      mkdir -p "$(dirname "$KEYFILE")" 2>/dev/null || true
      openssl rand -base64 48 > "$KEYFILE" 2>/dev/null && chmod 600 "$KEYFILE" 2>/dev/null || true
    fi
    if [ ! -s "$KEYFILE" ]; then
      log "ERROR: encryption enabled but no key available (env or $KEYFILE) - aborting"
      exit 1
    fi
    PASSARGS=("-pass" "file:$KEYFILE")
  fi
  enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in "$1" -out "$2" "${PASSARGS[@]}"; }
  log "encryption ON (AES-256-CBC/PBKDF2) - vault will hold .enc only"
else
  enc() { cp -f "$1" "$2"; }
fi

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
  enc "$LOCAL_SNAP" "$DEST/rah-latest.db$([ $ENC = 1 ] && echo .enc)"
fi

# ---- dated history: ship any gzip snapshot not yet in the vault -------------
EXT=""; [ $ENC = 1 ] && EXT=".enc"
for gz in backups/rah-*.sqlite.gz; do
  [ -e "$gz" ] || break
  base="$(basename "$gz" .sqlite.gz)"          # rah-20261021T214500Z
  target="$DEST/history/$base.db$EXT"
  if [ ! -s "$target" ]; then
    TMPH="$(mktemp)" || { log "WARNING: mktemp failed - history skipped"; continue; }
    gunzip -c "$gz" > "$TMPH" || { log "WARNING: could not unpack $gz - skipped"; rm -f "$TMPH"; continue; }
    enc "$TMPH" "$target" && rm -f "$TMPH" || { log "WARNING: could not encrypt $gz - skipped"; rm -f "$TMPH" "$target"; }
  fi
done

# ---- rotate: keep the newest $VAULT_KEEP dated snapshots --------------------
ls -1 "$DEST/history"/rah-*"$EXT" 2>/dev/null | sort -r | tail -n +$((VAULT_KEEP + 1)) | while read -r old; do
  rm -f "$old"; log "pruned old vault snapshot $(basename "$old")"
done

# Encryption turned on after plaintext pushes? Retire the plaintext blobs so
# the vault holds .enc ONLY (the plaintext history already shipped stays in
# old vault commits until the vault repo itself is history-scrubbed).
if [ $ENC = 1 ]; then
  find "$DEST" -name '*.db' -type f -exec rm -f {} + 
  git -C "$VAULT_DIR" add -A "$VAULT_FOLDER" 2>/dev/null || true
fi

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

# Restore recipe (kept in-file so the vault README stays doctrine-free):
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in rah-latest.db.enc \
#     -out restored.db -pass file:upload/rah-backups/.vaultkey   (or -pass env:...)
# then probe restored.db (SQLite open + Learner readable) before swapping it in.
