#!/usr/bin/env bash
# Task 97: PostgreSQL SURVIVAL LAYER - the PG equivalent of the SQLite
# db-guard chain (Task 57/60/61), built the same day as the flip so the
# recycle class that killed /home/z/rah-pg (proven: the Task-74 PG env did
# NOT survive recycle #8) can never take the deployment down.
#
#   pg-survival.sh ensure    boot-time: if .env is PG and PG is down, start
#                            it; if the data dir is GONE, initdb a fresh
#                            cluster and pg_restore the newest dump, then
#                            alert (the recycle-recovery path).
#   pg-survival.sh dump      daily: pg_dump -Fc + sidecar counts JSON into
#                            db/backups (keep 14) + upload/rah-backups
#                            (the proven-surviving mount) as -latest.
#   pg-survival.sh verify    weekly drill: restore the latest dump into a
#                            throwaway db and check the sidecar counts.
#
# SQLite (db/custom.db) is NEVER touched: it remains the pre-flip rollback
# artifact and db-guard keeps snapshotting it.
set -uo pipefail
cd /home/z/my-project || exit 1

ENV_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)
case "$ENV_URL" in
  postgresql://*) : ;;
  *) echo "pg-survival: .env is not postgresql - nothing to do"; exit 0 ;;
esac

PG_BASE="${ENV_URL%/*}"          # instance URL (no db name)
PG_DB="${ENV_URL##*/}"           # db name
PG_HOST=$(python3 -c "import urllib.parse,sys; u=urllib.parse.urlparse('$ENV_URL'); print(u.hostname or '127.0.0.1')")
PG_PORT=$(python3 -c "import urllib.parse,sys; u=urllib.parse.urlparse('$ENV_URL'); print(u.port or 5432)")
PGBIN="${PGBIN:-/home/z/rah-pg/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin}"
PGDATA="${PGDATA:-/home/z/rah-pg/pgdata}"
BACKUPS="db/backups"
UPLOAD="upload/rah-backups"
KEEP=14

pg_ok() { "$PGBIN/psql" -X -q -t -A "$ENV_URL" -c "SELECT 1" >/dev/null 2>&1; }

counts_sql() {
  "$PGBIN/psql" -X -q -t -A -F'|' "$ENV_URL" -c "
    SELECT
      (SELECT xp FROM \"Learner\" WHERE id='me'),
      (SELECT streak FROM \"Learner\" WHERE id='me'),
      (SELECT COUNT(*) FROM \"ReviewLog\"),
      (SELECT COUNT(*) FROM \"DailyStat\"),
      (SELECT COUNT(*) FROM \"Session\"),
      (SELECT COUNT(*) FROM \"LoginCode\"),
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public');"
}

case "${1:-}" in
  ensure)
    if pg_ok; then echo "pg-survival: PG up at $PG_HOST:$PG_PORT/$PG_DB"; exit 0; fi
    if [ ! -f "$PGDATA/PG_VERSION" ]; then
      echo "pg-survival: $PGDATA missing - RESTORE path"
      LATEST=""
      for cand in "$UPLOAD/pg-rah-latest.dump" "$BACKUPS"/pg-rah-*.dump; do
        [ -f "$cand" ] && LATEST="$cand" && break
      done
      if [ -z "$LATEST" ]; then
        echo "pg-survival: CRITICAL - PG down AND no dump found (checked $UPLOAD + $BACKUPS)"; exit 1
      fi
      mkdir -p "$(dirname "$PGDATA")"
      rm -rf "$PGDATA"
      echo "pg-survival: initdb fresh cluster + pg_restore from $LATEST"
      echo postgres > /tmp/pg-pwfile 2>/dev/null || true
      "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 >/dev/null 2>&1 \
        || { echo "pg-survival: initdb failed"; exit 1; }
      "$PGBIN/pg_ctl" -D "$PGDATA" -l /home/z/rah-pg/pg-tcp.log \
        -o "-h $PG_HOST -p $PG_PORT -k /tmp" start >/dev/null 2>&1 \
        || { echo "pg-survival: pg_ctl start failed"; exit 1; }
      sleep 1
      "$PGBIN/psql" -X -q -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -c "CREATE DATABASE \"$PG_DB\"" 2>/dev/null || true
      "$PGBIN/pg_restore" -x -O -h "$PG_HOST" -p "$PG_PORT" -U postgres -d "$PG_DB" "$LATEST" \
        || { echo "pg-survival: pg_restore FAILED from $LATEST"; exit 1; }
      echo "pg-survival: RESTORED $PG_DB from $(basename "$LATEST")"
      bash scripts/alert.sh CRITICAL pg-survival "PG data dir was gone - restored $PG_DB from $(basename "$LATEST")" || true
      pg_ok && echo "pg-survival: PG healthy after restore" || { echo "pg-survival: still down after restore"; exit 1; }
      exit 0
    fi
    echo "pg-survival: data dir exists but PG is down - starting"
    "$PGBIN/pg_ctl" -D "$PGDATA" -l /home/z/rah-pg/pg-tcp.log \
      -o "-h $PG_HOST -p $PG_PORT -k /tmp" start >/dev/null 2>&1 \
      || { echo "pg-survival: pg_ctl start failed"; exit 1; }
    sleep 1
    pg_ok && echo "pg-survival: PG up" || { echo "pg-survival: start did not help"; exit 1; }
    ;;

  dump)
    mkdir -p "$BACKUPS" "$UPLOAD"
    TS=$(date +%Y%m%d-%H%M%S)
    OUT="$BACKUPS/pg-rah-$TS.dump"
    # REG-2 port: the dump is a restore artifact, not a credential store -
    # Session/LoginCode ROWS are excluded (schema kept). Same doctrine as the
    # scrubbed SQLite snapshots (sessions die with the process that minted them).
    "$PGBIN/pg_dump" -Fc --exclude-table-data='"Session"' --exclude-table-data='"LoginCode"' "$ENV_URL" > "$OUT" \
      || { echo "pg-survival: pg_dump FAILED"; bash scripts/alert.sh CRITICAL pg-survival "daily PG dump failed" || true; exit 1; }
    IFS='|' read -r XP STREAK REV DAYS SESS CODES TABLES <<< "$(counts_sql)"
    SHA=$(sha256sum "$OUT" | cut -d' ' -f1)
    python3 - "$OUT.json" "$TS" "$XP" "$STREAK" "$REV" "$DAYS" "$TABLES" "$SHA" <<'PY'
import json, sys
out, ts, xp, streak, rev, days, tables, sha = sys.argv[1:9]
json.dump({"ts": ts, "xp": int(xp or 0), "streak": int(streak or 0),
           "reviews": int(rev or 0), "days": int(days or 0),
           "sessions": 0, "login_codes": 0,
           "tables": int(tables or 0), "sha256": sha}, open(out, "w"), indent=1)
PY
    cp "$OUT" "$UPLOAD/pg-rah-latest.dump" && cp "$OUT.json" "$UPLOAD/pg-rah-latest.json"
    cp "$OUT" "$BACKUPS/pg-rah-latest.dump" && cp "$OUT.json" "$BACKUPS/pg-rah-latest.json"
    ls -1t "$BACKUPS"/pg-rah-2*.dump 2>/dev/null | tail -n +$((KEEP+1)) | while read -r old; do
      rm -f "$old" "${old%.dump}.json"
    done
    echo "pg-survival: dumped $OUT (xp=$XP streak=$STREAK reviews=$REV tables=$TABLES, Session/LoginCode rows excluded) + shipped -latest to $BACKUPS + $UPLOAD"
    ;;

  verify)
    LATEST="$UPLOAD/pg-rah-latest.dump"
    [ -f "$LATEST" ] || { echo "pg-survival: no dump to verify"; exit 1; }
    "$PGBIN/psql" -X -q -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -c "DROP DATABASE IF EXISTS rah_drill WITH (FORCE)" >/dev/null
    "$PGBIN/psql" -X -q -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -c "CREATE DATABASE rah_drill" >/dev/null || { echo "pg-survival: drill db create failed"; exit 1; }
    if "$PGBIN/pg_restore" -x -O -h "$PG_HOST" -p "$PG_PORT" -U postgres -d rah_drill "$LATEST" >/dev/null 2>&1; then
      DRILL_URL="postgresql://postgres@$PG_HOST:$PG_PORT/rah_drill"
      GOT=$("$PGBIN/psql" -X -q -t -A -F'|' "$DRILL_URL" -c "
        SELECT (SELECT xp FROM \"Learner\" WHERE id='me'), (SELECT COUNT(*) FROM \"ReviewLog\"), (SELECT COUNT(*) FROM \"DailyStat\");")
      WANT=$(python3 -c "
import json
d = json.load(open('$UPLOAD/pg-rah-latest.json'))
print(f\"{d['xp']}|{d['reviews']}|{d['days']}\")")
      if [ "$GOT" = "$WANT" ]; then
        echo "pg-survival: restore drill PASS ($GOT == sidecar)"
      else
        echo "pg-survival: restore drill MISMATCH got=$GOT want=$WANT"
        bash scripts/alert.sh CRITICAL pg-survival "restore drill mismatch: got=$GOT want=$WANT" || true
        exit 1
      fi
    else
      echo "pg-survival: restore drill FAILED (pg_restore error)"
      bash scripts/alert.sh CRITICAL pg-survival "weekly restore drill failed on pg_restore" || true
      exit 1
    fi
    "$PGBIN/psql" -X -q -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -c "DROP DATABASE IF EXISTS rah_drill WITH (FORCE)" >/dev/null
    ;;

  *)
    echo "usage: pg-survival.sh ensure|dump|verify"; exit 2 ;;
esac
