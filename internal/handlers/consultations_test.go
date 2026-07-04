package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/auth"
	appdb "medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

// signInAndGetCookie creates a user, signs in, and returns the session cookie.
func signInAndGetCookie(t *testing.T, database *sql.DB, authH *handlers.AuthHandler, email, password string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	models.UserCreate(ctx, database, uuid.New().String(), models.CreateUserInput{
		Email: email, Name: "Test User", PasswordHash: string(hash), Role: "USER", Theme: "SYSTEM",
	})

	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	r := httptest.NewRequest(http.MethodPost, "/api/auth/signin", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	wrapWithSession(http.HandlerFunc(authH.SignIn)).ServeHTTP(w, r)

	for _, c := range w.Result().Cookies() {
		if c.Name == "session" {
			return c
		}
	}
	t.Fatal("no session cookie in sign-in response")
	return nil
}

func TestConsultationList_Pagination(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	consultH := &handlers.ConsultationHandler{DB: database}
	ctx := context.Background()

	// Get session cookie
	cookie := signInAndGetCookie(t, database, authH, "list@test.com", "pass1234")

	// Get the user ID by email
	u, _, err := models.UserFindByEmail(ctx, database, "list@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	// Create 5 consultations
	for i := 0; i < 5; i++ {
		models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
			Date:   time.Now().UTC().AddDate(0, 0, -i),
			Type:   "CONSULTATION",
			UserID: u.ID,
		})
	}

	r := httptest.NewRequest(http.MethodGet, "/api/consultations?page=1&limit=3", nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()

	wrapWithSession(auth.RequireAuth(http.HandlerFunc(consultH.List))).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp struct {
		Data  []struct {
			UserName string `json:"userName"`
		} `json:"data"`
		Total int `json:"total"`
		Page  int `json:"page"`
		Limit int `json:"limit"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Data) != 3 {
		t.Errorf("data len = %d, want 3", len(resp.Data))
	}
	if resp.Total != 5 {
		t.Errorf("total = %d, want 5", resp.Total)
	}
	if resp.Page != 1 {
		t.Errorf("page = %d, want 1", resp.Page)
	}
	for i, item := range resp.Data {
		if item.UserName != "Test User" {
			t.Errorf("data[%d].userName = %q, want %q", i, item.UserName, "Test User")
		}
	}
}

func TestConsultationCreate_Handler(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	consultH := &handlers.ConsultationHandler{DB: database}

	cookie := signInAndGetCookie(t, database, authH, "create@test.com", "pass5678")

	body, _ := json.Marshal(map[string]any{
		"date":  fmt.Sprintf("%s", time.Now().UTC().Format("2006-01-02")),
		"type":  "CONSULTATION",
		"notes": "Test note",
	})
	r := httptest.NewRequest(http.MethodPost, "/api/consultations", bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.AddCookie(cookie)
	w := httptest.NewRecorder()

	wrapWithSession(auth.RequireAuth(http.HandlerFunc(consultH.Create))).ServeHTTP(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var resp map[string]map[string]any
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["data"]["type"] != "CONSULTATION" {
		t.Errorf("type = %v, want CONSULTATION", resp["data"]["type"])
	}
}
