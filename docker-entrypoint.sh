#!/bin/sh
set -e

echo "[medlog] Starting container (version: ${MEDLOG_VERSION:-unknown})"

# Ensure uploads directory exists and has correct permissions
echo "[medlog] Checking uploads directory: ${FILES_PATH:-/app/data/uploads}"
UPLOAD_DIR="${FILES_PATH:-/app/data/uploads}"
if [ ! -d "$UPLOAD_DIR" ]; then
  echo "[medlog] Creating uploads directory..."
  mkdir -p "$UPLOAD_DIR"
fi
echo "[medlog] Uploads directory ready"

if [ -z "$SKIP_MIGRATIONS" ] || [ "$SKIP_MIGRATIONS" = "false" ]; then
  echo "[medlog] Running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "[medlog] Skipping migrations (SKIP_MIGRATIONS=$SKIP_MIGRATIONS)"
fi

echo "[medlog] Launching application..."
exec node server.js
