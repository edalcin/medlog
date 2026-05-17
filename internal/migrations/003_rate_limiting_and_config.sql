-- +goose Up
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
    ip           TEXT NOT NULL,
    window_start DATETIME NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ip, window_start)
);

CREATE TABLE IF NOT EXISTS app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS app_config;
DROP TABLE IF EXISTS rate_limit_attempts;
