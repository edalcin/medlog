package db

import (
	"database/sql"
	"testing"
)

// SetupTestDB opens an in-memory SQLite database, runs all goose migrations,
// and registers cleanup. Tests get an isolated, fully-migrated schema.
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := Open(":memory:")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	if err := Migrate(database); err != nil {
		database.Close()
		t.Fatalf("migrate test db: %v", err)
	}
	t.Cleanup(func() { database.Close() })
	return database
}
