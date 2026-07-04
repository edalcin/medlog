-- +goose Up
-- Repairs DATETIME columns written before internal/db.Open started passing
-- _time_format=sqlite to the driver. Until then, modernc.org/sqlite wrote
-- time.Time parameters using Go's t.String() format ("... +0000 UTC"),
-- which SQLite's strftime()/date() functions cannot parse (they return
-- NULL). Every value bound this way is always UTC (the app only ever
-- passes time.Now().UTC() or dates parsed with no explicit location), so
-- the broken suffix is always the literal " +0000 UTC" — stripping it
-- leaves a plain "YYYY-MM-DD HH:MM:SS[.fraction]" string, which SQLite
-- parses natively (already-correct rows don't match the LIKE pattern and
-- are left untouched).
UPDATE users        SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE users        SET updated_at = substr(updated_at, 1, length(updated_at) - 10) WHERE updated_at LIKE '% +0000 UTC';
UPDATE specialties  SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE clinics      SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE clinics      SET updated_at = substr(updated_at, 1, length(updated_at) - 10) WHERE updated_at LIKE '% +0000 UTC';
UPDATE professionals SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE professionals SET updated_at = substr(updated_at, 1, length(updated_at) - 10) WHERE updated_at LIKE '% +0000 UTC';
UPDATE professional_specialties SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE phones       SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE consultations SET date       = substr(date, 1, length(date) - 10)             WHERE date LIKE '% +0000 UTC';
UPDATE consultations SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE consultations SET updated_at = substr(updated_at, 1, length(updated_at) - 10) WHERE updated_at LIKE '% +0000 UTC';
UPDATE file_categories SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE files        SET uploaded_at = substr(uploaded_at, 1, length(uploaded_at) - 10) WHERE uploaded_at LIKE '% +0000 UTC';
UPDATE file_file_categories SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE user_professional_sharing SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE user_clinic_sharing SET created_at = substr(created_at, 1, length(created_at) - 10) WHERE created_at LIKE '% +0000 UTC';
UPDATE login_logs   SET timestamp  = substr(timestamp, 1, length(timestamp) - 10)     WHERE timestamp LIKE '% +0000 UTC';

-- +goose Down
-- No-op: this only reformats existing DATETIME text values to a form
-- SQLite's date functions can parse. There is no meaningful "undo" for a
-- data-format repair (the prior format was simply broken).
SELECT 1;
