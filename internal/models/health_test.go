package models_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"medlog/internal/db"
	"medlog/internal/models"
)

// TestObservationFindSeries_PrimaryPrevailsOverEvolutive guards ADR 0013:
// quando "primary" e "evolutive" existem para a mesma Data de coleta, a
// leitura devolve só a "primary" — mas nenhuma das duas é apagada.
func TestObservationFindSeries_PrimaryPrevailsOverEvolutive(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	if _, err := models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "series@test.com", Name: "Series", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	}); err != nil {
		t.Fatalf("UserCreate: %v", err)
	}

	// glucose_serum já vem semeado pela migração 007: ler, nunca criar.
	var indicatorID string
	if err := database.QueryRowContext(ctx,
		`SELECT id FROM health_indicators WHERE code = 'glucose_serum'`).Scan(&indicatorID); err != nil {
		t.Fatalf("indicador semeado: %v", err)
	}

	shared := time.Date(2026, 5, 8, 9, 0, 0, 0, time.UTC)
	lonely := time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC)

	err := models.ObservationInsertBatch(ctx, database, []models.Observation{
		{
			UserID: userID, IndicatorID: indicatorID, CollectedAt: shared,
			ValueText: "90", Provenance: models.ProvenancePrimary, Status: models.ObservationConfirmed,
		},
		{
			UserID: userID, IndicatorID: indicatorID, CollectedAt: shared,
			ValueText: "92", Provenance: models.ProvenanceEvolutive, Status: models.ObservationConfirmed,
		},
		{
			UserID: userID, IndicatorID: indicatorID, CollectedAt: lonely,
			ValueText: "95", Provenance: models.ProvenanceEvolutive, Status: models.ObservationConfirmed,
		},
	})
	if err != nil {
		t.Fatalf("ObservationInsertBatch: %v", err)
	}

	series, err := models.ObservationFindSeries(ctx, database, userID, "glucose_serum")
	if err != nil {
		t.Fatalf("ObservationFindSeries: %v", err)
	}
	if len(series) != 2 {
		t.Fatalf("series len = %d, want 2 (uma por collected_at)", len(series))
	}
	if series[0].Provenance != models.ProvenancePrimary || series[0].ValueText != "90" {
		t.Errorf("data compartilhada = %+v, want primary com valor 90", series[0])
	}
	if series[1].Provenance != models.ProvenanceEvolutive || series[1].ValueText != "95" {
		t.Errorf("data solitária = %+v, want evolutive com valor 95", series[1])
	}

	// Nada foi apagado: as duas linhas da data compartilhada continuam no banco.
	var total int
	if err := database.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM health_observations WHERE user_id = ? AND indicator_id = ?`,
		userID, indicatorID).Scan(&total); err != nil {
		t.Fatalf("count: %v", err)
	}
	if total != 3 {
		t.Errorf("linhas na tabela = %d, want 3 (nenhum DELETE)", total)
	}
}
