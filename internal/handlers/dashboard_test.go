package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
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

// DTOs mirroring the JSON shape of handlers.DashboardStats (whose element
// types are unexported), so the tests can decode and assert on fields
// directly instead of poking at handlers-package internals.

type nameCountDTO struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type yearCountDTO struct {
	Year  string `json:"year"`
	Count int    `json:"count"`
}

type monthCountDTO struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type profCountDTO struct {
	Name      string `json:"name"`
	Specialty string `json:"specialty"`
	Count     int    `json:"count"`
}

type dashboardStatsDTO struct {
	Summary struct {
		TotalConsultations int `json:"totalConsultations"`
		TotalEpisodes      int `json:"totalEpisodes"`
		TotalProfessionals int `json:"totalProfessionals"`
		TotalFiles         int `json:"totalFiles"`
	} `json:"summary"`
	BySpecialty    []nameCountDTO  `json:"bySpecialty"`
	ByClinic       []nameCountDTO  `json:"byClinic"`
	ByYear         []yearCountDTO  `json:"byYear"`
	ByProfessional []profCountDTO  `json:"byProfessional"`
	ByMonth        []monthCountDTO `json:"byMonth"`
}

func getDashboard(t *testing.T, dashH *handlers.DashboardHandler, cookie *http.Cookie) dashboardStatsDTO {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()

	wrapWithSession(auth.RequireAuth(http.HandlerFunc(dashH.Get))).ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp struct {
		Data dashboardStatsDTO `json:"data"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return resp.Data
}

func nameCountFor(entries []nameCountDTO, name string) int {
	for _, e := range entries {
		if e.Name == name {
			return e.Count
		}
	}
	return 0
}

func yearCountFor(entries []yearCountDTO, year string) int {
	for _, e := range entries {
		if e.Year == year {
			return e.Count
		}
	}
	return 0
}

func monthCountFor(entries []monthCountDTO, month string) int {
	for _, e := range entries {
		if e.Month == month {
			return e.Count
		}
	}
	return 0
}

func profCountFor(entries []profCountDTO, name string) int {
	for _, e := range entries {
		if e.Name == name {
			return e.Count
		}
	}
	return 0
}

// signInAdminAndGetCookie mirrors signInAndGetCookie but creates an ADMIN
// user. Kept local to this file (not a change to the shared helper) since
// only the dashboard admin-scoping test needs an admin session.
func signInAdminAndGetCookie(t *testing.T, database *sql.DB, authH *handlers.AuthHandler, email, password string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	models.UserCreate(ctx, database, uuid.New().String(), models.CreateUserInput{
		Email: email, Name: "Test Admin", PasswordHash: string(hash), Role: "ADMIN", Theme: "SYSTEM",
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
	t.Fatal("no session cookie in admin sign-in response")
	return nil
}

// TestDashboard_TypeFilter covers bug #1: breakdown queries must filter
// c.type = 'CONSULTATION' just like the summary card does. A non-CONSULTATION
// ("EVENT") record on the same professional/clinic/date must not be counted
// in byYear/byProfessional/bySpecialty/byClinic/byMonth.
func TestDashboard_TypeFilter(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	dashH := &handlers.DashboardHandler{DB: database}
	ctx := context.Background()

	email := "dash-typefilter@test.com"
	cookie := signInAndGetCookie(t, database, authH, email, "pass1234")
	u, _, err := models.UserFindByEmail(ctx, database, email)
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	specID := uuid.New().String()
	if _, err := models.SpecialtyCreate(ctx, database, specID, "Cardiologia"); err != nil {
		t.Fatalf("SpecialtyCreate: %v", err)
	}
	clinicID := uuid.New().String()
	if _, err := models.ClinicCreate(ctx, database, clinicID, "Clinica Central", nil, u.ID); err != nil {
		t.Fatalf("ClinicCreate: %v", err)
	}
	profID := uuid.New().String()
	if _, err := models.ProfessionalCreate(ctx, database, profID, models.Professional{
		Name:     "Dr. Filtro",
		IsActive: true,
		UserID:   &u.ID,
		ClinicID: &clinicID,
	}, []string{specID}); err != nil {
		t.Fatalf("ProfessionalCreate: %v", err)
	}

	date := time.Now().UTC()

	if _, err := models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
		Date: date, Type: "CONSULTATION", UserID: u.ID, ProfessionalID: &profID,
	}); err != nil {
		t.Fatalf("ConsultationCreate (CONSULTATION): %v", err)
	}
	if _, err := models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
		Date: date, Type: "EVENT", UserID: u.ID, ProfessionalID: &profID,
	}); err != nil {
		t.Fatalf("ConsultationCreate (EVENT): %v", err)
	}

	stats := getDashboard(t, dashH, cookie)

	if stats.Summary.TotalConsultations != 1 {
		t.Errorf("Summary.TotalConsultations = %d, want 1", stats.Summary.TotalConsultations)
	}
	if stats.Summary.TotalEpisodes != 1 {
		t.Errorf("Summary.TotalEpisodes = %d, want 1", stats.Summary.TotalEpisodes)
	}

	year := date.Format("2006")
	if c := yearCountFor(stats.ByYear, year); c != 1 {
		t.Errorf("ByYear[%s] = %d, want 1 (EVENT record leaked into byYear)", year, c)
	}

	month := date.Format("2006-01")
	if c := monthCountFor(stats.ByMonth, month); c != 1 {
		t.Errorf("ByMonth[%s] = %d, want 1 (EVENT record leaked into byMonth)", month, c)
	}

	if c := profCountFor(stats.ByProfessional, "Dr. Filtro"); c != 1 {
		t.Errorf("ByProfessional[Dr. Filtro] = %d, want 1 (EVENT record leaked into byProfessional)", c)
	}

	if c := nameCountFor(stats.BySpecialty, "Cardiologia"); c != 1 {
		t.Errorf("BySpecialty[Cardiologia] = %d, want 1 (EVENT record leaked into bySpecialty)", c)
	}

	if c := nameCountFor(stats.ByClinic, "Clinica Central"); c != 1 {
		t.Errorf("ByClinic[Clinica Central] = %d, want 1 (EVENT record leaked into byClinic)", c)
	}
}

// TestDashboard_SpecialtyFanout covers bug #2: a professional linked to two
// specialties must not have their consultations double-counted in
// bySpecialty (previously a plain JOIN against professional_specialties
// fanned out one row per specialty). The fix collapses to the
// alphabetically-first specialty via a subquery, same convention as
// ByProfessional/RecentConsultations/TopRated.
func TestDashboard_SpecialtyFanout(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	dashH := &handlers.DashboardHandler{DB: database}
	ctx := context.Background()

	email := "dash-fanout@test.com"
	cookie := signInAndGetCookie(t, database, authH, email, "pass1234")
	u, _, err := models.UserFindByEmail(ctx, database, email)
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	spec1ID := uuid.New().String() // "Cardiologia" - alphabetically first
	spec2ID := uuid.New().String() // "Dermatologia"
	if _, err := models.SpecialtyCreate(ctx, database, spec1ID, "Cardiologia"); err != nil {
		t.Fatalf("SpecialtyCreate: %v", err)
	}
	if _, err := models.SpecialtyCreate(ctx, database, spec2ID, "Dermatologia"); err != nil {
		t.Fatalf("SpecialtyCreate: %v", err)
	}

	profID := uuid.New().String()
	if _, err := models.ProfessionalCreate(ctx, database, profID, models.Professional{
		Name:     "Dr. Duplo",
		IsActive: true,
		UserID:   &u.ID,
	}, []string{spec1ID, spec2ID}); err != nil {
		t.Fatalf("ProfessionalCreate: %v", err)
	}

	for i := range 2 {
		if _, err := models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
			Date: time.Now().UTC().AddDate(0, 0, -i), Type: "CONSULTATION", UserID: u.ID, ProfessionalID: &profID,
		}); err != nil {
			t.Fatalf("ConsultationCreate: %v", err)
		}
	}

	stats := getDashboard(t, dashH, cookie)

	// Old (buggy) JOIN fan-out: each consultation counted once per linked
	// specialty -> Cardiologia=2, Dermatologia=2, total=4, rows=2.
	// Fixed: only the primary (alphabetically-first) specialty gets a row.
	total := nameCountFor(stats.BySpecialty, "Cardiologia") + nameCountFor(stats.BySpecialty, "Dermatologia")
	if total != 2 {
		t.Errorf("BySpecialty total for Dr. Duplo's 2 consultations = %d, want 2 (fan-out double-count)", total)
	}

	rows := 0
	for _, e := range stats.BySpecialty {
		if e.Name == "Cardiologia" || e.Name == "Dermatologia" {
			rows++
		}
	}
	if rows != 1 {
		t.Errorf("BySpecialty has %d rows for Dr. Duplo's specialties, want exactly 1 (specialties must collapse to the primary one)", rows)
	}
}

// TestDashboard_UserScoping confirms the existing (already-correct)
// user_id scoping still holds after the query changes: each regular user
// only sees their own data, and an ADMIN sees the combined dataset.
func TestDashboard_UserScoping(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	dashH := &handlers.DashboardHandler{DB: database}
	ctx := context.Background()

	emailA := "dash-usera@test.com"
	emailB := "dash-userb@test.com"
	cookieA := signInAndGetCookie(t, database, authH, emailA, "pass1234")
	cookieB := signInAndGetCookie(t, database, authH, emailB, "pass1234")

	userA, _, err := models.UserFindByEmail(ctx, database, emailA)
	if err != nil {
		t.Fatalf("UserFindByEmail A: %v", err)
	}
	userB, _, err := models.UserFindByEmail(ctx, database, emailB)
	if err != nil {
		t.Fatalf("UserFindByEmail B: %v", err)
	}

	profAID := uuid.New().String()
	if _, err := models.ProfessionalCreate(ctx, database, profAID, models.Professional{
		Name: "Dr. Alice", IsActive: true, UserID: &userA.ID,
	}, nil); err != nil {
		t.Fatalf("ProfessionalCreate A: %v", err)
	}
	profBID := uuid.New().String()
	if _, err := models.ProfessionalCreate(ctx, database, profBID, models.Professional{
		Name: "Dr. Bob", IsActive: true, UserID: &userB.ID,
	}, nil); err != nil {
		t.Fatalf("ProfessionalCreate B: %v", err)
	}

	if _, err := models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
		Date: time.Now().UTC(), Type: "CONSULTATION", UserID: userA.ID, ProfessionalID: &profAID,
	}); err != nil {
		t.Fatalf("ConsultationCreate A: %v", err)
	}
	if _, err := models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
		Date: time.Now().UTC(), Type: "CONSULTATION", UserID: userB.ID, ProfessionalID: &profBID,
	}); err != nil {
		t.Fatalf("ConsultationCreate B: %v", err)
	}

	statsA := getDashboard(t, dashH, cookieA)
	if statsA.Summary.TotalConsultations != 1 {
		t.Errorf("user A Summary.TotalConsultations = %d, want 1", statsA.Summary.TotalConsultations)
	}
	if c := profCountFor(statsA.ByProfessional, "Dr. Bob"); c != 0 {
		t.Errorf("user A dashboard leaked Dr. Bob's consultations: count = %d, want 0", c)
	}
	if c := profCountFor(statsA.ByProfessional, "Dr. Alice"); c != 1 {
		t.Errorf("user A ByProfessional[Dr. Alice] = %d, want 1", c)
	}

	statsB := getDashboard(t, dashH, cookieB)
	if statsB.Summary.TotalConsultations != 1 {
		t.Errorf("user B Summary.TotalConsultations = %d, want 1", statsB.Summary.TotalConsultations)
	}
	if c := profCountFor(statsB.ByProfessional, "Dr. Alice"); c != 0 {
		t.Errorf("user B dashboard leaked Dr. Alice's consultations: count = %d, want 0", c)
	}
	if c := profCountFor(statsB.ByProfessional, "Dr. Bob"); c != 1 {
		t.Errorf("user B ByProfessional[Dr. Bob] = %d, want 1", c)
	}

	adminCookie := signInAdminAndGetCookie(t, database, authH, "dash-admin@test.com", "pass1234")
	statsAdmin := getDashboard(t, dashH, adminCookie)
	if statsAdmin.Summary.TotalConsultations != 2 {
		t.Errorf("admin Summary.TotalConsultations = %d, want 2", statsAdmin.Summary.TotalConsultations)
	}
	if c := profCountFor(statsAdmin.ByProfessional, "Dr. Alice"); c != 1 {
		t.Errorf("admin ByProfessional[Dr. Alice] = %d, want 1", c)
	}
	if c := profCountFor(statsAdmin.ByProfessional, "Dr. Bob"); c != 1 {
		t.Errorf("admin ByProfessional[Dr. Bob] = %d, want 1", c)
	}
}
