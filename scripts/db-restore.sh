#!/usr/bin/env bash
# DATA SURVIVAL - restore side (Task 60/61; REG-2 sources, Task 62). The
# workspace can be reprovisioned from git at any time (sometimes from a stale
# ref), and the gitignored live DB dies with it. Restore-if-missing ONLY -
# never touches an existing live DB. Source preference:
#   1. db/sync/rah-latest.db          - hourly watchdog/db-sync snapshot
#                                       (freshest; local, gitignored)
#   2. db/vault-work/rah-web/rah-latest.db - the PRIVATE vault repo clone
#                                       (offsite; refreshed here when present)
#   3. backups/rah-*.sqlite.gz        - timestamped local history
# (The OSS mount copies under upload/rah-backups are covered by db-guard.sh,
# which is the first restore chance at boot. After a full workspace rebuild
# the vault clone is gone too - cloning it back needs credentials that do not
# live in the repo, so the OSS mount is the true rebuild-proof offsite.)
# Versioned migrations (db-migrate-safe.sh, run right after by ensure-server.sh)
# then bring the schema forward and record history (fixes the P3005 hole that
# a bare `db push` restore used to leave behind).
set -u
# Task 87-d: GUARD_ROOT-aware (same convention as db-guard.sh). The hardcoded
# cd made this script silently operate on the CANONICAL workspace even when
# GUARD_DB pointed elsewhere - a clone drill could not exercise the vault
# source, and any non-canonical deployment path would restore the wrong tree.
ROOT="${GUARD_ROOT:-/home/z/my-project}"
cd "$ROOT" || exit 1

DB="db/custom.db"

[ -s "$DB" ] && exit 0  # live db present; nothing to restore

# 1) freshest: the local latest snapshot
if [ -s "db/sync/rah-latest.db" ]; then
  rm -f "$DB-journal" "$DB-wal" "$DB-shm"
  cp -a db/sync/rah-latest.db "$DB"
  echo "restore: db/sync/rah-latest.db -> $DB ($(du -h "$DB" | cut -f1))"
  exit 0
fi

# 2) offsite: the PRIVATE vault clone (REG-2; refresh then restore).
# Encryption-aware: when the vault holds .enc blobs (RAH_VAULT_ENC=1 doctrine),
# decrypt with the OSS-mount key file or the env passphrase, then verify.
V="db/vault-work/rah-web/rah-latest.db"
if [ -d db/vault-work/.git ]; then
  git -C db/vault-work pull --ff-only -q origin main 2>/dev/null || true
fi
if [ ! -s "$V" ] && [ -s "db/vault-work/rah-web/rah-latest.db.enc" ]; then
  DEC_ARGS=(-pass "file:upload/rah-backups/.vaultkey")
  [ -n "${RAH_VAULT_PASSPHRASE:-}" ] && DEC_ARGS=(-pass "env:RAH_VAULT_PASSPHRASE")
  if openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
       -in db/vault-work/rah-web/rah-latest.db.enc -out "$V.tmp" "${DEC_ARGS[@]}" 2>/dev/null \
     && mv -f "$V.tmp" "$V"; then
    echo "restore: decrypted vault blob -> $V"
  else
    echo "restore: vault blob is encrypted and no usable key was found - skipping vault source"
  fi
fi
if [ -s "$V" ]; then
  rm -f "$DB-journal" "$DB-wal" "$DB-shm"
  cp -a "$V" "$DB"
  echo "restore: $V -> $DB ($(du -h "$DB" | cut -f1))"
  exit 0
fi

# 3) fallback: newest timestamped local history snapshot
LATEST=$(ls -1t backups/rah-*.sqlite.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "restore: no live db and no snapshots; genuinely first boot"
  exit 0
fi

rm -f "$DB-journal" "$DB-wal" "$DB-shm"
gunzip -c "$LATEST" > "$DB" || { echo "restore: gunzip FAILED"; rm -f "$DB"; exit 1; }
echo "restore: $(basename "$LATEST") -> $DB ($(du -h "$DB" | cut -f1))"
exit 0
