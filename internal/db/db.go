package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

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

	// modernc.org/sqlite defaults to writing time.Time params via Go's
	// t.String() ("2026-03-03 00:00:00 +0000 UTC"), which SQLite's
	// strftime()/date() cannot parse — they silently return NULL, so any
	// row written this way vanishes from date-based GROUP BYs (byYear,
	// byMonth) while still counting fine everywhere else. "sqlite" format
	// writes a form SQLite's own date functions understand.
	sep := "?"
	if strings.Contains(dsn, "?") {
		sep = "&"
	}
	db, err := sql.Open("sqlite", dsn+sep+"_time_format=sqlite")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}

	// SQLite allows one writer at a time, and PRAGMA settings (busy_timeout,
	// foreign_keys) are per-connection, not per-database — a pool that opens
	// more than one physical connection silently runs some queries on a
	// connection that never got these PRAGMAs, and concurrent writers race
	// SQLite's own lock instead of queuing behind Go's pool mutex (surfaces
	// as "database is locked" / "db error" under any concurrent write, e.g.
	// attaching several files at once). One connection sidesteps both.
	db.SetMaxOpenConns(1)

	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
		"PRAGMA busy_timeout=5000",
	} {
		if _, err := db.Exec(pragma); err != nil {
			return nil, fmt.Errorf("sqlite pragma %q: %w", pragma, err)
		}
	}

	return db, nil
}
