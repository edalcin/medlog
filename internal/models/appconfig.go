package models

import (
	"context"
	"database/sql"
	"errors"
)

// ConfigGet reads an app_config value, returning the fallback when the key was
// never set. app_config holds operational preferences only: credentials live
// in environment variables, and the session secret is stored as a hash.
func ConfigGet(ctx context.Context, db *sql.DB, key, fallback string) (string, error) {
	var value string
	err := db.QueryRowContext(ctx, `SELECT value FROM app_config WHERE key = ?`, key).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) || value == "" {
		return fallback, nil
	}
	if err != nil {
		return fallback, err
	}
	return value, nil
}

// ConfigSet stores an app_config value.
func ConfigSet(ctx context.Context, db *sql.DB, key, value string) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO app_config (key, value) VALUES (?, ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}
