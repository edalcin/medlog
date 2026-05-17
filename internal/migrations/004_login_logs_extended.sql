-- +goose Up
ALTER TABLE login_logs ADD COLUMN ip_address TEXT;
ALTER TABLE login_logs ADD COLUMN user_agent TEXT;

-- +goose Down
-- SQLite does not support DROP COLUMN in this version; down migration is a no-op
