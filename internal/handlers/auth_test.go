package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/auth"
	"medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/middleware"
	"medlog/internal/models"
)

// wrapWithSession wraps a handler with the session manager middleware.
func wrapWithSession(h http.Handler) http.Handler {
	return auth.Manager.LoadAndSave(h)
}

func TestSignIn_Success(t *testing.T) {
	database := db.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	ctx := context.Background()

	// Create a user with known password
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "login@test.com", Name: "Login Test", PasswordHash: string(hash), Role: "USER", Theme: "SYSTEM",
	})

	body, _ := json.Marshal(map[string]string{"email": "login@test.com", "password": "password123"})
	r := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	wrapWithSession(http.HandlerFunc(authH.SignIn)).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]map[string]string
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["data"]["email"] != "login@test.com" {
		t.Errorf("email = %q, want %q", resp["data"]["email"], "login@test.com")
	}
}

func TestSignIn_InvalidCredentials(t *testing.T) {
	database := db.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	ctx := context.Background()

	hash, _ := bcrypt.GenerateFromPassword([]byte("correct"), bcrypt.MinCost)
	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "bad@test.com", Name: "Bad", PasswordHash: string(hash), Role: "USER", Theme: "SYSTEM",
	})

	body, _ := json.Marshal(map[string]string{"email": "bad@test.com", "password": "wrong"})
	r := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	wrapWithSession(http.HandlerFunc(authH.SignIn)).ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestSignIn_RateLimit(t *testing.T) {
	database := db.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}

	rateLimitedHandler := middleware.RateLimit(database, false)(
		wrapWithSession(http.HandlerFunc(authH.SignIn)),
	)

	body, _ := json.Marshal(map[string]string{"email": "x@x.com", "password": "x"})

	var lastCode int
	for i := 0; i < 7; i++ {
		r := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.RemoteAddr = "1.2.3.4:9999"
		w := httptest.NewRecorder()
		rateLimitedHandler.ServeHTTP(w, r)
		lastCode = w.Code
	}

	if lastCode != http.StatusTooManyRequests {
		t.Errorf("after 7 attempts, status = %d, want %d", lastCode, http.StatusTooManyRequests)
	}
}
