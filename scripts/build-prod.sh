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

# Task 99 (review P1, triply-proven): PRESERVE THE ARTIFACT. Recycles #8/#9
# wiped .next/BUILD_ID twice in two days and the boot road fell back to dev
# (the exact "website not working" class). Rebuilding in place works but
# takes minutes and depends on the toolchain; restoring the preserved
# artifact is seconds and reproduces the EXACT intended build. The tgz
# (~102 MB) exceeds GitHub's 100 MB file limit, so it lives on
# upload/rah-backups - the mount that survived every recycle so far - as an
# atomically replaced -latest file plus a sha256 manifest. ensure-server.sh
# consumes it.
ARTIFACT_TGZ="upload/rah-backups/rah-build-latest.tgz"
ARTIFACT_JSON="upload/rah-backups/rah-build-latest.json"
mkdir -p upload/rah-backups
if tar -czf "$ARTIFACT_TGZ.tmp" -C .next standalone 2>/dev/null; then
  ART_SHA=$(sha256sum "$ARTIFACT_TGZ.tmp" | cut -d' ' -f1)
  mv "$ARTIFACT_TGZ.tmp" "$ARTIFACT_TGZ"
  python3 - "$ARTIFACT_JSON" "$(cat .next/BUILD_ID)" "$ART_SHA" <<'PY'
import json, sys, datetime
out, build_id, sha = sys.argv[1:4]
json.dump({"build_id": build_id, "sha256": sha,
           "ts": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
           "bytes": None, "note": "restore via ensure-server.sh when BUILD_ID is wiped"},
          open(out, "w"), indent=1)
PY
  echo "build-prod: artifact preserved -> $ARTIFACT_TGZ (sha256=${ART_SHA:0:12}...)"
else
  echo "build-prod: WARNING - artifact preservation failed (build itself is fine)"
fi

echo "build-prod: standalone static chunks: $(ls .next/standalone/.next/static/chunks | wc -l)"
echo "build-prod: standalone public files:  $(ls .next/standalone/public | wc -l)"
