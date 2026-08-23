package db

import (
	"database/sql"
	"testing"

	"github.com/pressly/goose/v3"

	"medlog/internal/migrations"
)

// TestMigrate007HealthIndicators checks that migration 007 applies, seeds the
// indicator catalog, adds the document metadata columns, and rolls back.
func TestMigrate007HealthIndicators(t *testing.T) {
	database := SetupTestDB(t)

	var indicators int
	if err := database.QueryRow("SELECT COUNT(*) FROM health_indicators").Scan(&indicators); err != nil {
		t.Fatalf("count health_indicators: %v", err)
	}
	if indicators != 55 {
		t.Errorf("seeded indicators = %d, want 55", indicators)
	}

	var unit sql.NullString
	if err := database.QueryRow("SELECT unit FROM health_indicators WHERE code='glucose_serum'").Scan(&unit); err != nil {
		t.Fatalf("lookup glucose_serum: %v", err)
	}
	if unit.String != "mg/dL" {
		t.Errorf("glucose_serum unit = %q, want mg/dL", unit.String)
	}

	// Textual indicators are unitless on purpose (morphology, indices, ratios).
	if err := database.QueryRow("SELECT unit FROM health_indicators WHERE code='homa_ir'").Scan(&unit); err != nil {
		t.Fatalf("lookup homa_ir: %v", err)
	}
	if unit.Valid {
		t.Errorf("homa_ir unit = %q, want NULL", unit.String)
	}

	for _, column := range []string{"collected_at", "lab_name", "report_number"} {
		if _, err := database.Exec("SELECT " + column + " FROM files LIMIT 0"); err != nil {
			t.Errorf("files.%s missing: %v", column, err)
		}
	}

	// The observation status and provenance domains are enforced by the schema.
	if _, err := database.Exec(`INSERT INTO health_observations
		(id, user_id, indicator_id, collected_at, value_text, provenance, status)
		VALUES ('o1', 'u1', 'i1', '2026-05-08 00:00:00', '105', 'guessed', 'review')`); err == nil {
		t.Error("invalid provenance was accepted, want CHECK violation")
	}

	goose.SetBaseFS(migrations.SQL)
	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatalf("set dialect: %v", err)
	}
	if err := goose.Down(database, "."); err != nil {
		t.Fatalf("goose down: %v", err)
	}
	if _, err := database.Exec("SELECT 1 FROM health_indicators LIMIT 0"); err == nil {
		t.Error("health_indicators survived rollback")
	}
	if _, err := database.Exec("SELECT collected_at FROM files LIMIT 0"); err == nil {
		t.Error("files.collected_at survived rollback")
	}
	if err := goose.Up(database, "."); err != nil {
		t.Fatalf("goose up after down: %v", err)
	}
}
