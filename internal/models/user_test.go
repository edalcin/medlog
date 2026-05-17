package models_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"medlog/internal/db"
	"medlog/internal/models"
)

func TestUserCreate(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	id := uuid.New().String()
	u, err := models.UserCreate(ctx, database, id, models.CreateUserInput{
		Email:        "test@example.com",
		Name:         "Test User",
		PasswordHash: "$2a$10$abc",
		Role:         "USER",
		Theme:        "SYSTEM",
	})
	if err != nil {
		t.Fatalf("UserCreate: %v", err)
	}
	if u.ID != id {
		t.Errorf("id = %q, want %q", u.ID, id)
	}
	if u.Email != "test@example.com" {
		t.Errorf("email = %q, want %q", u.Email, "test@example.com")
	}
	if u.Role != "USER" {
		t.Errorf("role = %q, want %q", u.Role, "USER")
	}
	if u.Theme != "SYSTEM" {
		t.Errorf("theme = %q, want %q", u.Theme, "SYSTEM")
	}
}

func TestUserUpdate_SingleSQL(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	id := uuid.New().String()
	_, err := models.UserCreate(ctx, database, id, models.CreateUserInput{
		Email: "before@example.com", Name: "Before", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})
	if err != nil {
		t.Fatalf("UserCreate: %v", err)
	}

	newName := "After"
	newTheme := "DARK"
	u, err := models.UserUpdate(ctx, database, id, models.UpdateUserInput{
		Name:  &newName,
		Theme: &newTheme,
	})
	if err != nil {
		t.Fatalf("UserUpdate: %v", err)
	}
	if u.Name != newName {
		t.Errorf("name = %q, want %q", u.Name, newName)
	}
	if u.Theme != newTheme {
		t.Errorf("theme = %q, want %q", u.Theme, newTheme)
	}
	// Email unchanged
	if u.Email != "before@example.com" {
		t.Errorf("email = %q, want %q", u.Email, "before@example.com")
	}
}

func TestUserFindAll(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	for i, email := range []string{"a@test.com", "b@test.com", "c@test.com"} {
		_ = i
		_, err := models.UserCreate(ctx, database, uuid.New().String(), models.CreateUserInput{
			Email: email, Name: email, PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
		})
		if err != nil {
			t.Fatalf("UserCreate %s: %v", email, err)
		}
	}

	users, err := models.UserFindAll(ctx, database)
	if err != nil {
		t.Fatalf("UserFindAll: %v", err)
	}
	if len(users) != 3 {
		t.Errorf("len = %d, want 3", len(users))
	}
}

func TestUserUpdatePassword(t *testing.T) {
	database := db.SetupTestDB(t)
	ctx := context.Background()

	id := uuid.New().String()
	_, err := models.UserCreate(ctx, database, id, models.CreateUserInput{
		Email: "pw@test.com", Name: "PW", PasswordHash: "old", Role: "USER", Theme: "SYSTEM",
	})
	if err != nil {
		t.Fatalf("UserCreate: %v", err)
	}

	if err := models.UserUpdatePassword(ctx, database, id, "newhash"); err != nil {
		t.Fatalf("UserUpdatePassword: %v", err)
	}

	// Verify hash changed via FindByEmail
	_, hash, err := models.UserFindByEmail(ctx, database, "pw@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}
	if hash != "newhash" {
		t.Errorf("hash = %q, want %q", hash, "newhash")
	}
}

