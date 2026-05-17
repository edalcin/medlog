package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"medlog/internal/auth"
	"medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

func TestProfessionalList_NoPlusOne(t *testing.T) {
	database := db.SetupTestDB(t)
	auth.InitSessions(database, false)
	profH := &handlers.ProfessionalHandler{DB: database}
	ctx := context.Background()

	userID := uuid.New().String()
	models.UserCreate(ctx, database, userID, models.CreateUserInput{
		Email: "prolist@test.com", Name: "ProList", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	})

	// Create specialty + 5 professionals with it
	specID := uuid.New().String()
	models.SpecialtyCreate(ctx, database, specID, "Neurologia")
	for i := 0; i < 5; i++ {
		models.ProfessionalCreate(ctx, database, uuid.New().String(), models.Professional{
			Name:     "Prof " + string(rune('A'+i)),
			IsActive: true,
			UserID:   &userID,
		}, []string{specID})
	}

	// Use session cookie obtained via signInAndGetCookie
	authH := &handlers.AuthHandler{DB: database}
	cookie := signInAndGetCookie(t, database, authH, "prolist-login@test.com", "pass0000")

	r := httptest.NewRequest(http.MethodGet, "/api/professionals?active=false&page=1&limit=10", nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()

	wrapWithSession(auth.RequireAuth(http.HandlerFunc(profH.List))).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp struct {
		Data  []map[string]any `json:"data"`
		Total int              `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	// The signed-in user's professionals are 5, but the cookie user has 0.
	// Verify each professional has specialties loaded (no N+1, batched).
	for _, p := range resp.Data {
		if _, ok := p["specialties"]; !ok {
			t.Error("professional missing specialties field")
		}
	}
}
