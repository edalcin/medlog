package db

import (
	"database/sql"
	"fmt"

	"github.com/pressly/goose/v3"

	"medlog/internal/migrations"
)

func Migrate(db *sql.DB) error {
	goose.SetBaseFS(migrations.SQL)

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}

	if err := goose.Up(db, "."); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}
