package models_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"medlog/internal/db"
	"medlog/internal/models"
)

func TestConsultationCreate(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	_, err := models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "con@test.com", Name: "Con", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})
	if err != nil {
		t.Fatalf("UserCreate: %v", err)
	}

	date := time.Date(2024, 1, 15, 0, 0, 0, 0, time.UTC)
	id := uuid.New().String()
	c, err := models.ConsultationCreate(ctx, database, id, models.CreateConsultationInput{
		Date:   date,
		Type:   "CONSULTATION",
		UserID: userID,
	})
	if err != nil {
		t.Fatalf("ConsultationCreate: %v", err)
	}
	if c.ID != id {
		t.Errorf("id = %q, want %q", c.ID, id)
	}
	if c.Type != "CONSULTATION" {
		t.Errorf("type = %q, want %q", c.Type, "CONSULTATION")
	}
	if c.UserID != userID {
		t.Errorf("userID = %q, want %q", c.UserID, userID)
	}
	if len(c.Files) != 0 {
		t.Errorf("files len = %d, want 0", len(c.Files))
	}
}

func TestConsultationFindByID(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "fid@test.com", Name: "FID", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	id := uuid.New().String()
	models.ConsultationCreate(ctx, database, id, models.CreateConsultationInput{
		Date: time.Now().UTC(), Type: "EPISODE", UserID: userID,
	})

	c, err := models.ConsultationFindByID(ctx, database, id)
	if err != nil {
		t.Fatalf("ConsultationFindByID: %v", err)
	}
	if c.ID != id {
		t.Errorf("id = %q, want %q", c.ID, id)
	}
}

func TestConsultationFindByID_NotFound(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	_, err := models.ConsultationFindByID(ctx, database, "nonexistent")
	if err == nil {
		t.Error("expected error for missing consultation, got nil")
	}
}

func TestConsultationUpdate(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "upd@test.com", Name: "Upd", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	id := uuid.New().String()
	models.ConsultationCreate(ctx, database, id, models.CreateConsultationInput{
		Date: time.Now().UTC(), Type: "CONSULTATION", UserID: userID,
	})

	notes := "Updated notes"
	rating := 5
	updated, err := models.ConsultationUpdate(ctx, database, id, models.UpdateConsultationInput{
		Notes:  &notes,
		Rating: &rating,
	})
	if err != nil {
		t.Fatalf("ConsultationUpdate: %v", err)
	}
	if updated.Notes == nil || *updated.Notes != notes {
		t.Errorf("notes = %v, want %q", updated.Notes, notes)
	}
	if updated.Rating == nil || *updated.Rating != rating {
		t.Errorf("rating = %v, want %d", updated.Rating, rating)
	}
}

func TestConsultationDelete(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "del@test.com", Name: "Del", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	id := uuid.New().String()
	models.ConsultationCreate(ctx, database, id, models.CreateConsultationInput{
		Date: time.Now().UTC(), Type: "CONSULTATION", UserID: userID,
	})

	if err := models.ConsultationDelete(ctx, database, id, "/tmp"); err != nil {
		t.Fatalf("ConsultationDelete: %v", err)
	}

	_, err := models.ConsultationFindByID(ctx, database, id)
	if err == nil {
		t.Error("expected not found after delete")
	}
}

func TestConsultationCountByUserID(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "cnt@test.com", Name: "Cnt", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	for i := 0; i < 3; i++ {
		models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
			Date: time.Now().UTC(), Type: "CONSULTATION", UserID: userID,
		})
	}

	n, err := models.ConsultationCountByUserID(ctx, database, userID)
	if err != nil {
		t.Fatalf("ConsultationCountByUserID: %v", err)
	}
	if n != 3 {
		t.Errorf("count = %d, want 3", n)
	}
}
