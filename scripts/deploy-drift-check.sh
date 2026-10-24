#!/usr/bin/env bash
# Task 95 (review P1 #5): deployment drift detector.
#
# "Alert when the served build differs from the intended release" - the
# recycle of 2026-10-24 15:07 UTC made the gap real: the workspace lost
# .next/, boot fell back to `next dev`, and the learner was served a DEV
# server with nobody noticing. This check turns that state into an alert.
#
# Checks (in order):
#   1. PROD BUILD PRESENT   - .next/BUILD_ID must exist. Missing => the boot
#                             chain can only fall back to dev (devCode,
#                             unminified, Turbopack) => CRITICAL.
#   2. SERVED PROCESS       - a `next dev` process while a prod build exists
#                             => WARN (prod exists but is not being served).
#   3. INTENDED RELEASE     - .next/BUILD_ID vs backups/.intended-build-id
#                             (recorded by build-prod.sh at build time).
#                             Mismatch => WARN naming both ids, so a build
#                             that replaced the intended release is a visible
#                             event, not a silent mutation.
#
# Exit 0 = no drift; exit 1 = drift found (alerts already emitted).
# Wired into: ensure-server.sh (boot) + watchdog.sh (daily tick).
set -u
cd "$(dirname "$0")/.."

BUILD_ID_FILE=".next/BUILD_ID"
INTENDED_FILE="backups/.intended-build-id"
ALERT="scripts/alert.sh"
drift=0

served_build() {
  if [ -s "$BUILD_ID_FILE" ]; then cat "$BUILD_ID_FILE"; else echo "(none)"; fi
}

# 1. prod build present?
if [ ! -s "$BUILD_ID_FILE" ]; then
  bash "$ALERT" CRITICAL deploy-drift "no production build (.next/BUILD_ID missing) - boot can only serve DEV fallback; run scripts/build-prod.sh"
  drift=1
else
  BUILD_ID="$(cat "$BUILD_ID_FILE")"

  # 2. dev process serving while prod exists?
  if pgrep -f "next dev" >/dev/null 2>&1; then
    bash "$ALERT" WARN deploy-drift "prod build $BUILD_ID exists but a 'next dev' process is serving - restart via scripts/ensure-server.sh to serve the release build"
    drift=1
  fi

  # 3. intended release record
  if [ -s "$INTENDED_FILE" ]; then
    INTENDED="$(cat "$INTENDED_FILE")"
    if [ "$BUILD_ID" != "$INTENDED" ]; then
      bash "$ALERT" WARN deploy-drift "served build $BUILD_ID differs from intended release $INTENDED - if this rebuild was intended, re-run scripts/build-prod.sh so the record refreshes"
      drift=1
    fi
  else
    bash "$ALERT" WARN deploy-drift "no intended-release record ($INTENDED_FILE missing) - run scripts/build-prod.sh once to record it"
    drift=1
  fi

  # 4. running build vs HEAD (the /api/version beacon's own doctrine: served
  # SHA must equal git HEAD after every change; a mismatch means the RUNNING
  # process predates the code on disk - e.g. a commit landed after boot and
  # every health check stayed green). WARN, not CRITICAL: content drift only.
  if command -v curl >/dev/null 2>&1; then
    SERVED_SHA="$(curl -sf --max-time 5 http://localhost:3000/api/version 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4)"
    HEAD_SHA="$(git rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
    if [ -n "$SERVED_SHA" ] && [ "$SERVED_SHA" != "$HEAD_SHA" ] && [ "$SERVED_SHA" != "no-git" ]; then
      bash "$ALERT" WARN deploy-drift "running build serves $SERVED_SHA but HEAD is $HEAD_SHA - the process predates the current code; restart via scripts/ensure-server.sh to serve the release"
      drift=1
    fi
  fi
fi

if [ "$drift" = 0 ]; then
  echo "deploy-drift: OK (build $(served_build) == intended)"
fi
exit $drift
