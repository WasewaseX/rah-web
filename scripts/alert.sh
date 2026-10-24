#!/usr/bin/env bash
# Task 95 (review P1 #10): the unified alert primitive. One append-only log
# (gitignored db/alerts.log - machine-local, REG-2) that every watchdog/
# boot/backup component writes through, so failures are EVENTS, not lines
# buried in component logs. vault-sync ships a digest to the private vault
# (rah-web/alerts/recent.log), so the alert history survives recycles even
# though the local log does not.
#
# Usage:  bash scripts/alert.sh <SEVERITY> <COMPONENT> <message...>
#         SEVERITY: INFO | WARN | CRITICAL
# Never fatal: alerting must never break the caller (exit 0 always).
set -u
cd "$(dirname "$0")/.."

SEV="${1:-INFO}"; shift || true
COMP="${1:-generic}"; shift || true
MSG="$*"
LOG="db/alerts.log"

case "$SEV" in
  INFO|WARN|CRITICAL) : ;;
  *) SEV="INFO" ;;
esac

mkdir -p db
line="$(date -u +%Y-%m-%dT%H:%M:%SZ)|$SEV|$COMP|$MSG"
echo "$line" >> "$LOG"
case "$SEV" in
  CRITICAL) echo "[alert] CRITICAL [$COMP] $MSG" >&2 ;;
  WARN)     echo "[alert] WARN [$COMP] $MSG" >&2 ;;
esac
exit 0
