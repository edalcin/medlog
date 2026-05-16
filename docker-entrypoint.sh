#!/bin/sh
# MedLog entrypoint - handles data migration and startup

DATA_DIR="/app/data"
DB_DIR="${DATA_DIR}/db"
UPLOADS_DIR="${DATA_DIR}/uploads"
MIGRATION_FILE="${DATA_DIR}/migration_dump.sql"
MIGRATION_DONE="${DATA_DIR}/migration_dump.done"

# Create directories if they don't exist
mkdir -p "${DB_DIR}" "${UPLOADS_DIR}"

# If a migration dump exists and hasn't been applied, import it
if [ -f "${MIGRATION_FILE}" ] && [ ! -f "${MIGRATION_DONE}" ]; then
    echo "=== Found migration_dump.sql, importing data ==="
    if sqlite3 "${DB_DIR}/medlog.sqlite" < "${MIGRATION_FILE}" 2>&1; then
        echo "=== Migration successful! ==="
        touch "${MIGRATION_DONE}"
        mv "${MIGRATION_FILE}" "${MIGRATION_FILE}.imported"
        echo "Migrated at $(date)" > "${MIGRATION_DONE}"
    else
        echo "=== Migration FAILED! Check logs. ==="
        echo "=== Starting MedLog anyway (database may be empty) ==="
    fi
fi

exec /medlog
