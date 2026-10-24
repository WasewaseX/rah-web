#!/usr/bin/env bash
# Task 91: the ONLY sanctioned way to produce the production build.
#
# Bare `next build` regenerates .next/standalone WITHOUT the static assets
# (Next's documented standalone deployment step). The Task 91 browser E2E
# caught the exact failure this creates: a prod server that serves fresh HTML
# referencing chunks it then 404s - a blank page with zero console errors.
# dev-or-prod.sh now self-heals the copy on every prod boot, but building
# through this wrapper keeps the artifact correct at build time too.
set -eu
cd /home/z/my-project

npx next build "$@"

rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
mkdir -p .next/standalone/public
cp -r public/. .next/standalone/public/

echo "build-prod: BUILD_ID=$(cat .next/BUILD_ID)"
# Task 95 (review P1 #5): record the intended release so deploy-drift-check
# can alert when the served build ever differs from what was last built
# here on purpose.
mkdir -p backups
cat .next/BUILD_ID > backups/.intended-build-id
echo "build-prod: intended-release record -> backups/.intended-build-id"
echo "build-prod: standalone static chunks: $(ls .next/standalone/.next/static/chunks | wc -l)"
echo "build-prod: standalone public files:  $(ls .next/standalone/public | wc -l)"
