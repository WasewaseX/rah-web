#!/usr/bin/env bash
# Keeps the watchdog alive across environment rebuilds: if no watchdog loop is
# running, start one detached. The watchdog carries the DAILY learner-data
# snapshot+push (the offsite copy that survives environment loss).
cd /home/z/my-project || exit 1
if pgrep -f "bash scripts/watchdog.sh" > /dev/null 2>&1; then
  exit 0
fi
nohup bash scripts/watchdog.sh > /dev/null 2>&1 &
disown
echo "watchdog started (pid $!)"
