#!/usr/bin/env bash
# Pull the LIVE production database from the running Rah deployment back into
# the workspace. This is the data-preservation guard: the container's SQLite
# file is EPHEMERAL (every deploy replaces the whole container), so the
# workspace copy must be refreshed from production BEFORE it gets packaged
# into a new build. Introduced after the Oct-20 incident where an update
# shipped the stale workspace DB over the container's and reset the learner
# to "First Words" again.
#
# Usage:  bash scripts/db-pull.sh [BASE_URL] [OUT_DB]
#   BASE_URL  deployment base (default $PREVIEW_URL, else the known preview)
#   OUT_DB    where to place the pulled DB (default db/custom.db)
#
# On success also writes stats JSON next to OUT_DB as "<OUT_DB>.stats.json".
#
# Exit codes:
#   0  pulled + validated (+ previous db backed up)
#   3  endpoint missing (old package / token unconfigured) -> caller may fall back
#   4  deployment unreachable -> caller may fall back
#   5  auth refused or downloaded file failed validation -> caller MUST NOT
#      fall back silently (falling back would ship stale data over real data)
set -uo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${1:-${PREVIEW_URL:-https://preview-chat-d027ce73-8b7f-4fc0-910a-b2c665a663c0.space-z.ai/}}"
OUT_DB="${2:-db/custom.db}"
BASE_URL="${BASE_URL%/}"

# The admin token gates the download. It lives next to the DB (the build
# packages it into the container) or in RAH_ADMIN_TOKEN. Generate one on
# first use so the NEXT deployed package accepts it.
if [ ! -s db/admin-token ] && [ -z "${RAH_ADMIN_TOKEN:-}" ]; then
  ( umask 077; head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > db/admin-token )
  echo "🔑 generated new admin token -> db/admin-token"
fi
TOKEN="$(cat db/admin-token 2>/dev/null || echo "${RAH_ADMIN_TOKEN:-}")"

TMP="$(mktemp /tmp/rah-pull-XXXXXX.db)"
trap 'rm -f "$TMP"' EXIT

CODE="$(curl -sS -o "$TMP" -w '%{http_code}' --max-time 60 \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/db" 2>/dev/null)"
CURL_EXIT=$?
if [ "$CURL_EXIT" -ne 0 ]; then
  echo "❌ pull: deployment unreachable ($BASE_URL, curl exit $CURL_EXIT)"
  exit 4
fi

case "$CODE" in
  200) ;;
  404) echo "⚠️  pull: /api/admin/db not available on the deployment (old package or unconfigured token); nothing pulled"; exit 3 ;;
  401|403) echo "❌ pull: auth refused (HTTP $CODE) - token mismatch; refusing to touch the local db"; exit 5 ;;
  *) echo "❌ pull: unexpected HTTP $CODE"; exit 5 ;;
esac

# Validate before touching anything: real SQLite file, integrity ok, Learner
# table present. A half-written or foreign file must never replace OUT_DB.
STATS="$(python3 - "$TMP" <<'PY'
import json, sqlite3, sys
p = sys.argv[1]
with open(p, "rb") as f:
    if f.read(16) != b"SQLite format 3\x00":
        sys.exit("not a SQLite file")
con = sqlite3.connect(p)
try:
    ok = con.execute("PRAGMA integrity_check").fetchone()[0]
    if ok != "ok":
        sys.exit(f"integrity_check: {ok}")
    names = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "Learner" not in names:
        sys.exit("no Learner table (foreign database?)")
    xp, streak = con.execute("SELECT xp, streak FROM Learner LIMIT 1").fetchone()
    counts = {t.lower(): con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
              for t in ("User", "ReviewLog", "Achievement", "CardState", "Material")}
    print(json.dumps({"xp": xp, "streak": streak, **counts}))
finally:
    con.close()
PY
)" || { echo "❌ pull: downloaded file failed validation - local db untouched"; exit 5; }

mkdir -p db/backups
if [ -f "$OUT_DB" ]; then
  BK="db/backups/pre-pull-$(date +%Y%m%d-%H%M%S).db"
  cp -a "$OUT_DB" "$BK"
  echo "🗂  previous db backed up -> $BK"
  # keep the newest 20 pre-pull backups
  ls -1t db/backups/pre-pull-*.db 2>/dev/null | tail -n +21 | xargs -r rm -f
fi

mv "$TMP" "$OUT_DB"
# a stale WAL/SHM from the replaced file would corrupt the new one on open
rm -f "$OUT_DB-wal" "$OUT_DB-shm"
printf '%s' "$STATS" > "$OUT_DB.stats.json"

# The local dev server keeps the replaced file open (fd -> old inode), so its
# writes would fork onto an orphaned file. Bounce it once when we swapped the
# default learner DB (mirror pulls to other paths skip this).
if [ "$(readlink -f "$OUT_DB" 2>/dev/null)" = "$(readlink -f db/custom.db 2>/dev/null)" ] \
  && curl -sf -o /dev/null --max-time 3 http://localhost:3000/api/version 2>/dev/null; then
  echo "🔁 bouncing local dev server to reopen the fresh db..."
  pkill -f "next dev -p 3000" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  sleep 2
  bash scripts/ensure-server.sh >/dev/null 2>&1 || true
fi

echo "✅ pulled production db -> $OUT_DB"
echo "📊 $STATS"
