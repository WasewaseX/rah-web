#!/usr/bin/env bash
# Task 89 (perf): the deployment's supervisor restarts the app via the
# package "dev" script on its own pts session. While a verified standalone
# production build exists, that entry point boots PRODUCTION (the standalone
# server: minified, precompiled, gzip on) instead of `next dev` - which served
# every page through on-demand compilation. RAH_PROD=0 forces real dev mode
# for local iteration. ensure-server.sh keeps the same preference for its own
# revive path, so every boot road converges on the same rule.
cd /home/z/my-project || exit 1

# Task 98: .env must win over platform-inherited env on EVERY road. The
# reprovision baked a stale SQLite DATABASE_URL into the supervisor session
# env; this script used to source .env only on the prod branch, so the dev
# fallback below silently served SQLite on a PostgreSQL-era tree (dotenv
# semantics: process env wins). Source it once here, before any branch;
# the prod branch re-sources it (idempotent).
set -a; . ./.env 2>/dev/null; set +a

if [ "${RAH_PROD:-1}" != "0" ] && [ -f .next/standalone/server.js ] && [ -f .next/BUILD_ID ]; then
  set -a; . ./.env 2>/dev/null; set +a
  export NODE_ENV=production
  # Task 91: self-healing static sync. `next build` regenerates .next/standalone
  # WITHOUT the static assets (Next's documented standalone step), so a bare
  # build leaves a prod server that 404s every chunk -> blank page (caught by
  # the Task 91 browser E2E). Re-sync static + public on EVERY prod boot; the
  # copy is milliseconds and makes the boot road immune to forgotten copies.
  if [ -d .next/static ] && ! diff -rq .next/static .next/standalone/.next/static > /dev/null 2>&1; then
    rm -rf .next/standalone/.next/static
    cp -r .next/static .next/standalone/.next/static
    echo "$(date -Is) standalone static re-synced from the fresh build"
  fi
  if [ -d public ] && ! diff -rq public .next/standalone/public > /dev/null 2>&1; then
    mkdir -p .next/standalone/public
    cp -r public/. .next/standalone/public/
    echo "$(date -Is) standalone public/ re-synced from the fresh build"
  fi
  echo "$(date -Is) booting PRODUCTION standalone build (RAH_PROD=${RAH_PROD:-1}, BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null))"
  node .next/standalone/server.js 2>&1 | tee server.log
  exit 0
fi

echo "$(date -Is) booting dev mode (RAH_PROD=${RAH_PROD:-0:-1} or no production build present)" >&2
exec next dev -p 3000 2>&1 | tee dev.log
