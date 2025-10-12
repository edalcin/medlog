#!/bin/sh
set -e

echo "[medlog] Starting container (version: ${MEDLOG_VERSION:-unknown})"

# Ensure uploads directory exists and has correct permissions
echo "[medlog] Checking uploads directory: ${FILES_PATH:-/app/data/uploads}"
UPLOAD_DIR="${FILES_PATH:-/app/data/uploads}"

# Check current user
echo "[medlog] Running as user: $(whoami) (UID: $(id -u))"

# Create directory if it doesn't exist
if [ ! -d "$UPLOAD_DIR" ]; then
  echo "[medlog] Creating uploads directory..."
  mkdir -p "$UPLOAD_DIR"
fi

# Fix permissions - ensure nextjs user (UID 1001) can write
echo "[medlog] Setting permissions on uploads directory..."
chown -R nextjs:nodejs "$UPLOAD_DIR"
chmod -R 755 "$UPLOAD_DIR"

echo "[medlog] Uploads directory ready: $(ls -ld $UPLOAD_DIR)"

if [ -z "$SKIP_MIGRATIONS" ] || [ "$SKIP_MIGRATIONS" = "false" ]; then
  echo "[medlog] Running prisma migrate deploy (as nextjs user)..."
  su-exec nextjs npx prisma migrate deploy
else
  echo "[medlog] Skipping migrations (SKIP_MIGRATIONS=$SKIP_MIGRATIONS)"
fi

echo "[medlog] Launching application (as nextjs user)..."
exec su-exec nextjs node server.js
