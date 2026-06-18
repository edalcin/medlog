package models_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"medlog/internal/db"
	"medlog/internal/models"
)

func TestProfessionalCreate(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "pro@test.com", Name: "Pro", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	id := uuid.New().String()
	p, err := models.ProfessionalCreate(ctx, database, id, models.Professional{
		Name:     "Dr. House",
		IsActive: true,
		UserID:   &userID,
	}, nil)
	if err != nil {
		t.Fatalf("ProfessionalCreate: %v", err)
	}
	if p.ID != id {
		t.Errorf("id = %q, want %q", p.ID, id)
	}
	if p.Name != "Dr. House" {
		t.Errorf("name = %q, want %q", p.Name, "Dr. House")
	}
	if !p.IsActive {
		t.Error("IsActive = false, want true")
	}
	if len(p.Specialties) != 0 {
		t.Errorf("specialties len = %d, want 0", len(p.Specialties))
	}
}

func TestProfessionalCreate_WithSpecialties(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "spec@test.com", Name: "Spec", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	// Create a specialty
	specID := uuid.New().String()
	_, err := models.SpecialtyCreate(ctx, database, specID, "Cardiologia")
	if err != nil {
		t.Fatalf("SpecialtyCreate: %v", err)
	}

	id := uuid.New().String()
	p, err := models.ProfessionalCreate(ctx, database, id, models.Professional{
		Name:     "Dr. Cardia",
		IsActive: true,
		UserID:   &userID,
	}, []string{specID})
	if err != nil {
		t.Fatalf("ProfessionalCreate with specialty: %v", err)
	}
	if len(p.Specialties) != 1 {
		t.Fatalf("specialties len = %d, want 1", len(p.Specialties))
	}
	if p.Specialties[0].Name != "Cardiologia" {
		t.Errorf("specialty name = %q, want %q", p.Specialties[0].Name, "Cardiologia")
	}
}

func TestProfessionalFindAll_BatchSpecialties(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "batch@test.com", Name: "Batch", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	specID := uuid.New().String()
	models.SpecialtyCreate(ctx, database, specID, "Ortopedia")

	// Create 3 professionals, 2 with the specialty
	for i, name := range []string{"Doc A", "Doc B", "Doc C"} {
		pid := uuid.New().String()
		var specs []string
		if i < 2 {
			specs = []string{specID}
		}
		models.ProfessionalCreate(ctx, database, pid, models.Professional{
			Name: name, IsActive: true, UserID: &userID,
		}, specs)
	}

	list, err := models.ProfessionalFindAll(ctx, database, userID, false, false, "", "", "", 0, 0)
	if err != nil {
		t.Fatalf("ProfessionalFindAll: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("len = %d, want 3", len(list))
	}

	withSpec := 0
	for _, p := range list {
		withSpec += len(p.Specialties)
	}
	if withSpec != 2 {
		t.Errorf("total specialties = %d, want 2", withSpec)
	}
}

func TestProfessionalCount(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "count@test.com", Name: "Count", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	for _, name := range []string{"P1", "P2"} {
		models.ProfessionalCreate(ctx, database, uuid.New().String(), models.Professional{
			Name: name, IsActive: true, UserID: &userID,
		}, nil)
	}

	n, err := models.ProfessionalCount(ctx, database, userID, false, false, "", "", "")
	if err != nil {
		t.Fatalf("ProfessionalCount: %v", err)
	}
	if n != 2 {
		t.Errorf("count = %d, want 2", n)
	}
}
