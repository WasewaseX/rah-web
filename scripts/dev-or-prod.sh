#!/usr/bin/env bash
# Task 89 (perf): the deployment's supervisor restarts the app via the
# package "dev" script on its own pts session. While a verified standalone
# production build exists, that entry point boots PRODUCTION (the standalone
# server: minified, precompiled, gzip on) instead of `next dev` - which served
# every page through on-demand compilation. RAH_PROD=0 forces real dev mode
# for local iteration. ensure-server.sh keeps the same preference for its own
# revive path, so every boot road converges on the same rule.
cd /home/z/my-project || exit 1

if [ "${RAH_PROD:-1}" != "0" ] && [ -f .next/standalone/server.js ] && [ -f .next/BUILD_ID ]; then
  set -a; . ./.env 2>/dev/null; set +a
  export NODE_ENV=production
  echo "$(date -Is) booting PRODUCTION standalone build (RAH_PROD=${RAH_PROD:-1}, BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null))"
  node .next/standalone/server.js 2>&1 | tee server.log
  exit 0
fi

echo "$(date -Is) booting dev mode (RAH_PROD=${RAH_PROD:-0:-1} or no production build present)" >&2
exec next dev -p 3000 2>&1 | tee dev.log
