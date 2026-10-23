#!/usr/bin/env bash
# Rah data guard - the "learner data must survive updates" guarantee.
#
# Incident (2026-10-21): a platform update rebuilt the workspace from git.
# db/custom.db is untracked (by design: private learner data must not be
# published), so the update erased it. The boot supervisor then ran
# `db:push`, which silently created a brand-new empty database. The schema
# canary (MistakeFamily reachable) passed - it checks SHAPE, not DATA - and
# the learner watched every achievement, every review and the whole FSRS
# schedule vanish. The "First Words" trophy re-fired because ReviewLog went
# 0 -> 1 on their first review of the empty DB.
#
# This guard closes that class of failure:
#   boot mode  - if the live DB is missing or FRESH (no real usage) and a
#                backup exists, restore the newest VERIFIED backup, loudly.
#                If the DB holds real usage, snapshot it BEFORE any schema
#                work (db:push) can touch it.
#   daily mode - snapshot + rotate while the server runs (supervisor tick).
#
# Backups live in TWO places:
#   db/backups            - local, same volume as the DB (fast, dies with
#                           the workspace on a git-replace update)
#   upload/rah-backups    - the platform OSS mount (SURVIVES workspace
#                           replacement - proven by files from Oct 8/10
#                           living there across the 2026-10-21 rebuild)
#
# A backup is only ever restored after the integrity probe passes: the file
# must open as SQLite and contain the Learner table. Restore never fires
# when the live DB shows real usage, so a stale backup can never clobber
# newer learner data.
#
# Paths are env-overridable (GUARD_*) so tests run against throwaway dirs.

set -u

GUARD_ROOT="${GUARD_ROOT:-/home/z/my-project}"
GUARD_DB="${GUARD_DB:-$GUARD_ROOT/db/custom.db}"
GUARD_LOCAL="${GUARD_LOCAL:-$GUARD_ROOT/db/backups}"
GUARD_OFFSITE="${GUARD_OFFSITE:-$GUARD_ROOT/upload/rah-backups}"
GUARD_LOG="${GUARD_LOG:-$GUARD_ROOT/db/boot-guard.log}"
# Task 87-d (drill-found gap): the vault clone is a valid restore source -
# without it, an unavailable OSS mount left the boot path "starting clean"
# while a verified offsite copy sat in db/vault-work.
GUARD_VAULT="${GUARD_VAULT:-$GUARD_ROOT/db/vault-work/rah-web/rah-latest.db}"
GUARD_KEEP="${GUARD_KEEP:-14}"
MODE="${1:-boot}"
STAMP_FILE="$GUARD_OFFSITE/.last-backup-day"

mkdir -p "$GUARD_LOCAL" "$GUARD_OFFSITE" "$(dirname "$GUARD_DB")"

# Single-flight: a concurrent guard run (boot + daily tick) must be a no-op.
exec 9>"$(dirname "$GUARD_DB")/.guard.lock"
flock -n 9 || exit 0

log() { echo "[db-guard] $(date -Is) $*" >> "$GUARD_LOG"; echo "[db-guard] $*"; }

# File-only logging for use inside command substitutions - stdout there is
# the return channel (e.g. newest_backup prints the chosen path).
logf() { echo "[db-guard] $(date -Is) $*" >> "$GUARD_LOG"; }

# Probe: file opens as SQLite AND the Learner table is readable.
probe() {
  local f="$1"
  [ -f "$f" ] || return 1
  python3 - "$f" <<'PY' 2>/dev/null
import sqlite3, sys
c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
c.execute('SELECT COUNT(*) FROM "Learner"').fetchone()
c.close()
PY
}

# Real-usage signal: any of these means the DB holds learner history that
# must not be treated as empty. The bare Learner row (created lazily with
# defaults on the first API call) is NOT usage.
is_fresh() {
  [ -f "$GUARD_DB" ] || return 0
  python3 - "$GUARD_DB" <<'PY' 2>/dev/null
import sqlite3, sys
c = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
l = c.execute('SELECT COUNT(*) FROM "Learner" WHERE xp>0 OR streak>0 OR lastActiveDay!=-1 OR gems>0 OR sp>0').fetchone()[0]
tables = ("ReviewLog", "CardState", "Achievement", "GameStat", "ChatMsg", "WritingSub", "SpeakSession", "Material")
used = 0
for t in tables:
    try:
        used += c.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
    except Exception:
        pass
c.close()
sys.exit(0 if (l == 0 and used == 0) else 1)
PY
}

# Newest verified backup across offsite-first then local. Prints the path.
newest_backup() {
  local dir f
  for dir in "$GUARD_OFFSITE" "$GUARD_LOCAL"; do
    # Newest first; skip non-.db files; probe each until one verifies.
    while IFS= read -r f; do
      if probe "$f"; then echo "$f"; return 0; fi
      logf "WARNING: backup failed integrity probe, skipping: $f"
    done < <(ls -1t "$dir"/custom-*.db 2>/dev/null)
  done
  return 1
}

rotate() {
  local dir="$1" f
  while IFS= read -r f; do rm -f "$f"; done < <(ls -1t "$dir"/custom-*.db 2>/dev/null | tail -n +$((GUARD_KEEP + 1)))
}

do_backup() {
  local tag="$1" dest ts ok
  is_fresh && { log "live DB is fresh/empty - no snapshot taken ($tag)"; return 0; }
  # WAL safety (Task 89): the live db runs in WAL mode now (readers never block
  # the writer). A raw cp of a WAL database can miss commits still sitting in
  # db/custom.db-wal, so fold them into the main file first. Checkpoint is
  # online and non-destructive; when the -wal file is absent (fresh restore)
  # this is a harmless no-op that costs ~1ms.
  python3 -c "
import sqlite3, sys
try:
    c = sqlite3.connect('$GUARD_DB')
    c.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    c.close()
except Exception as e:
    print(f'checkpoint skipped: {e}', file=sys.stderr)
" 2>/dev/null || true
  ts="$(date +%Y%m%d-%H%M%S)"
  ok=1
  for dest in "$GUARD_LOCAL" "$GUARD_OFFSITE"; do
    local i attempt
    for attempt in 1 2 3; do
      cp -f "$GUARD_DB" "$dest/custom-$ts-$tag.db.tmp" 2>/dev/null
      mv -f "$dest/custom-$ts-$tag.db.tmp" "$dest/custom-$ts-$tag.db" 2>/dev/null
      if probe "$dest/custom-$ts-$tag.db"; then ok=0; break; fi
      log "WARNING: snapshot copy $attempt failed integrity ($dest) - retrying"
      rm -f "$dest/custom-$ts-$tag.db"
      sleep 1
    done
  done
  if [ "$ok" -ne 0 ]; then log "ERROR: could not produce a verified snapshot ($tag) - continuing without one"; return 1; fi
  rotate "$GUARD_LOCAL"; rotate "$GUARD_OFFSITE"
  date +%F > "$STAMP_FILE" 2>/dev/null || true
  log "snapshot OK ($tag): custom-$ts-$tag.db -> db/backups + upload/rah-backups (keep $GUARD_KEEP)"
}

do_restore() {
  local src
  # Freshest sources first (REG-1/REG-2 lessons): the hourly db-sync snapshot,
  # then its OSS-mount mirror (the copy that survives a workspace rebuild),
  # then the private vault clone (Task 87-d: the offsite last defense must be
  # reachable from the FIRST boot responder, not only from db-restore.sh),
  # then the dated rotating backups.
  for fixed in "$GUARD_ROOT/db/sync/rah-latest.db" "$GUARD_OFFSITE/rah-latest.db" "$GUARD_VAULT"; do
    if probe "$fixed"; then
      log "FRESH LIVE DB - restoring from verified source: ${fixed#$GUARD_ROOT/}"
      cp -f "$fixed" "$GUARD_DB"
      if probe "$GUARD_DB"; then
        log "RESTORE OK: learner data recovered from ${fixed#$GUARD_ROOT/}"
        return 0
      fi
      log "ERROR: restore from $fixed failed probe - falling back"
      rm -f "$GUARD_DB"
    fi
  done
  if ! src="$(newest_backup)"; then
    log "live DB is fresh and NO verified backup exists anywhere - starting clean (nothing to restore)"
    return 1
  fi
  log "FRESH LIVE DB - restoring newest verified backup: $src"
  cp -f "$src" "$GUARD_DB"
  if probe "$GUARD_DB"; then
    log "RESTORE OK: learner data recovered from $(basename "$src")"
  else
    log "ERROR: restored file failed probe - removing and starting clean"
    rm -f "$GUARD_DB"
  fi
}

case "$MODE" in
  boot)
    if is_fresh; then do_restore || true; else do_backup boot || true; fi
    ;;
  daily)
    # Once per day (stamp shared with boot so boot counts as the day's backup).
    today="$(date +%F)"
    last="$(cat "$STAMP_FILE" 2>/dev/null || echo never)"
    if [ "$last" != "$today" ]; then do_backup daily || true; fi
    ;;
  *)
    echo "usage: db-guard.sh [boot|daily]" >&2; exit 2
    ;;
esac
