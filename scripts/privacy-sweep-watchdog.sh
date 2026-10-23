#!/usr/bin/env bash
# Task 88 - watchdog wrapper for the privacy sweep (scripts/privacy-sweep.py).
# Runs daily from watchdog.sh. Keeps a date-stamped evidence log of the
# dangling-object state so the GitHub Support purge request is tracked until
# the day it can be closed. Never prints learner content or the token.
set -u
cd /home/z/my-project || exit 1
LOG="db/privacy-sweep.log"

OUT="$(timeout 180 python3 scripts/privacy-sweep.py 2>&1)"
CODE=$?

DANGLING="$(printf '%s\n' "$OUT" | grep -oE 'RESULT: [0-9]+ dangling of [0-9]+ probed' | head -1)"
BLOB="$(printf '%s\n' "$OUT" | grep -c 'STILL SERVED' || true)"
VAULT="$(printf '%s\n' "$OUT" | grep -oE 'private=(True|False)' | head -1)"
TREE="$(printf '%s\n' "$OUT" | grep -c 'ZERO learner-data paths' || true)"

{
  echo "$(date -Is) sweep: ${DANGLING:-no-result} | blob-still-served=$BLOB | vault ${VAULT:-unknown} | clean-tree-lines=$TREE | exit=$CODE"
  [ "$CODE" -eq 0 ] && echo "$(date -Is) sweep: CLEAN - the Support purge appears complete; update ROADMAP-AUDIT REG-2 addendum 3 and stop this monitor"
} >> "$LOG"

exit "$CODE"
