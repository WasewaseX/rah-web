#!/usr/bin/env bash
# Fullstack deploy: one command. Revive if needed, verify the app, ship the
# current state to GitHub, and print the freshness proof.
#   bash scripts/deploy.sh
cd /home/z/my-project || exit 1

PREVIEW_URL="${PREVIEW_URL:-https://preview-chat-d027ce73-8b7f-4fc0-910a-b2c665a663c0.space-z.ai/}"

echo "== 1. server"
bash scripts/ensure-server.sh || { echo "server not healthy; deploy aborted"; exit 1; }
LOCAL_VERSION=$(curl -s http://localhost:3000/api/version)
echo "local  : $LOCAL_VERSION"

echo "== 2. github"
git push origin HEAD -q || echo "(push skipped: nothing new or remote rejected)"
SHA=$(git rev-parse --short=12 HEAD)
REMOTE_SHA=$(curl -s "https://api.github.com/repos/${GIT_REPO:-WasewaseX/rah-web}/commits/${GIT_BRANCH:-main}" | grep -m1 '"sha"' | sed -E 's/.*"sha": "([^"]{12}).*/\1/')
echo "head   : $SHA  | remote main: ${REMOTE_SHA:-unknown}"

echo "== 3. preview"
PREVIEW_VERSION=$(curl -s --max-time 10 "${PREVIEW_URL%/}/api/version")
echo "preview: $PREVIEW_VERSION"

echo "== done"
echo "site   : $PREVIEW_URL"
