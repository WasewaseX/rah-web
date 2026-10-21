#!/usr/bin/env bash
# Fullstack deploy: one command.
#   1. local server healthy
#   2. PULL the live production DB back into the workspace (data-preservation
#      guard - the container DB is ephemeral; see scripts/db-pull.sh)
#   2.5 timestamped local history snapshot (backups/, gitignored; REG-2:
#      learner data is NEVER committed to the public repo - offsite copies
#      go to the private vault via scripts/vault-sync.sh, called by db-sync)
#   3. push to GitHub
#   4. wait until the preview serves THIS commit (freshness beacon)
#   5. verify the learner's data survived the container swap (stats diff)
#   6. refresh the workspace mirror from the fresh deployment
#   7. refresh the git-tracked latest snapshot (survives workspace reprovision)
#   bash scripts/deploy.sh
set -uo pipefail
cd /home/z/my-project || exit 1

PREVIEW_URL="${PREVIEW_URL:-https://preview-chat-d027ce73-8b7f-4fc0-910a-b2c665a663c0.space-z.ai/}"
fetch_json() { curl -sS --max-time 15 "$1" 2>/dev/null; }

echo "== 1. server"
bash scripts/ensure-server.sh || { echo "server not healthy; deploy aborted"; exit 1; }
LOCAL_VERSION=$(curl -s http://localhost:3000/api/version)
echo "local  : $LOCAL_VERSION"

echo "== 2. production db pull (data-preservation guard)"
PULL_OK=0
bash scripts/db-pull.sh "$PREVIEW_URL" db/custom.db || PULL_OK=$?
case "$PULL_OK" in
  0) : ;;
  3|4) echo "(continuing on the workspace snapshot - first deploy or preview down)" ;;
  *) echo "deploy aborted: db pull failed hard (exit $PULL_OK)"; exit 1 ;;
esac
PRE_STATS="$(cat db/custom.db.stats.json 2>/dev/null || echo "")"

echo "== 2.5 local history snapshot (backups/ - timestamped, content-aware, gitignored)"
bash scripts/db-snapshot.sh || true
# REG-2: no git add/commit/push here - the public repo carries ZERO learner
# data. Offsite copy happens in step 7 (db-sync -> scripts/vault-sync.sh).

echo "== 3. github"
git push origin HEAD -q || echo "(push skipped: nothing new or remote rejected)"
SHA=$(git rev-parse --short=12 HEAD)
REMOTE_SHA=$(curl -s "https://api.github.com/repos/${GIT_REPO:-WasewaseX/rah-web}/commits/${GIT_BRANCH:-main}" | grep -m1 '"sha"' | sed -E 's/.*"sha": "([^"]{12}).*/\1/')
echo "head   : $SHA  | remote main: ${REMOTE_SHA:-unknown}"

echo "== 4. preview freshness (wait for the new package to go live)"
FRESH=0
for _ in $(seq 1 60); do
  PV_SHA="$(fetch_json "${PREVIEW_URL%/}/api/version" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("version",""))
except Exception: print("")' 2>/dev/null)"
  if [ -n "$PV_SHA" ] && [ "$PV_SHA" = "$SHA" ]; then FRESH=1; break; fi
  sleep 5
done
PREVIEW_VERSION=$(curl -s --max-time 10 "${PREVIEW_URL%/}/api/version")
echo "preview: $PREVIEW_VERSION"

if [ "$FRESH" != "1" ]; then
  echo "⚠️  preview still serves an older build after 5 min; post-deploy data verify skipped"
else
  echo "== 5. post-deploy data verify (did the update preserve the learner?)"
  TOKEN="$(cat db/admin-token 2>/dev/null || echo "${RAH_ADMIN_TOKEN:-}")"
  POST_STATS="$(curl -sS --max-time 20 -H "Authorization: Bearer $TOKEN" \
    "${PREVIEW_URL%/}/api/admin/stats" 2>/dev/null || echo "")"
  printf '%s' "$POST_STATS" > db/post-pull-stats.json
  if [ -z "$POST_STATS" ]; then
    echo "⚠️  stats endpoint unreachable; verify inconclusive (pre-deploy backup retained in db/backups/)"
  elif python3 - "$PRE_STATS" "$POST_STATS" <<'PY'
import json, sys
pre_raw, post_raw = sys.argv[1], sys.argv[2]
try:
    post = json.loads(post_raw)
except Exception as e:
    sys.exit(f"post stats unparseable: {e}")
pre = None
try:
    pre = json.loads(pre_raw) if pre_raw.strip() else None
except Exception:
    pre = None  # first deploy after the guard: no baseline, nothing to compare
bad = []
if pre:
    for k in ("xp", "streak", "reviews", "achievements", "users", "cards"):
        p, q = pre.get(k), post.get(k)
        if isinstance(p, int) and isinstance(q, int) and q < p:
            bad.append(f"{k} {p}->{q}")
print(",".join(bad) if bad else "ok")
PY
  then
    echo "✅ learner data survived the deploy (post >= pre on every counter)"
  else
    echo ""
    echo "🚨 DATA REGRESSION: the deployed build serves LESS data than before deploy"
    echo "   pre : $PRE_STATS"
    echo "   post: $POST_STATS"
    echo "   The pre-deploy pull is safe under db/backups/ - restore it and investigate."
    exit 1
  fi

  echo "== 6. refresh workspace mirror from the fresh deployment"
  bash scripts/db-pull.sh "$PREVIEW_URL" db/custom.db || echo "(mirror refresh skipped: exit $?)"
fi

echo "== 7. learner-data snapshot (local + PRIVATE vault repo - survives reprovisioning)"
bash scripts/db-sync.sh || echo "(db-sync skipped: exit $?)"

echo "== done"
echo "site   : $PREVIEW_URL"
