#!/bin/sh
case "$1" in
  Username*) echo "$GH_PAT" ;;
  Password*) echo "$GH_PAT" ;;
esac
