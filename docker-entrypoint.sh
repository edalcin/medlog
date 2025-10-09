#!/bin/sh
set -e

echo "[medlog] Starting container (version: ${MEDLOG_VERSION:-unknown})"

if [ -z "$SKIP_MIGRATIONS" ] || [ "$SKIP_MIGRATIONS" = "false" ]; then
  echo "[medlog] Running prisma db push..."
  ./node_modules/.bin/prisma db push
else
  echo "[medlog] Skipping migrations (SKIP_MIGRATIONS=$SKIP_MIGRATIONS)"
fi

echo "[medlog] Launching application..."
exec node server.js
