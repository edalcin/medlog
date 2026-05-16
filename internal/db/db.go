package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func Open(dsn string) (*sql.DB, error) {
	if dsn != ":memory:" {
		dbPath := dsn
		if len(dsn) > 5 && dsn[:5] == "file:" {
			dbPath = dsn[5:]
			for i, c := range dbPath {
				if c == '?' {
					dbPath = dbPath[:i]
					break
				}
			}
		}
		dir := filepath.Dir(dbPath)
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("create db directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dsn+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}

	return db, nil
}
