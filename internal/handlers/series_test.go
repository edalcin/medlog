package handlers_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"medlog/internal/auth"
	appdb "medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

func indicatorID(t *testing.T, database *sql.DB, code string) string {
	t.Helper()
	var id string
	if err := database.QueryRow(`SELECT id FROM health_indicators WHERE code = ?`, code).Scan(&id); err != nil {
		t.Fatalf("indicator %q: %v", code, err)
	}
	return id
}

func day(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse("2006-01-02", s)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return d
}

func seriesRouter(h *handlers.SeriesHandler, userID string) http.Handler {
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth.Manager.Put(r.Context(), auth.SessionKeyUserID, userID)
			auth.Manager.Put(r.Context(), auth.SessionKeyRole, "USER")
			next.ServeHTTP(w, r)
		})
	})
	router.Get("/api/health-series", h.Index)
	router.Get("/api/health-series/{code}", h.Series)
	return wrapWithSession(router)
}

func getJSON[T any](t *testing.T, router http.Handler, url string) T {
	t.Helper()
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, url, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET %s = %d; body: %s", url, w.Code, w.Body.String())
	}
	var out struct{ Data T }
	if err := json.NewDecoder(w.Body).Decode(&out); err != nil {
		t.Fatalf("decode %s: %v", url, err)
	}
	return out.Data
}

// TestSeries_OnlyConfirmedAndOwnData guards the two rules the chart depends on:
// an observation still in review does not exist for the series (ADR 0009), and
// another user's result never leaks into it.
func TestSeries_OnlyConfirmedAndOwnData(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()

	mine := seedAdmin(t, ctx, database)
	other := seedAdmin(t, ctx, database)

	glucose := indicatorID(t, database, "glucose_serum")
	egfr := indicatorID(t, database, "egfr_ckd_epi_2009_black")
	tsh := indicatorID(t, database, "tsh")

	num := func(v float64) *float64 { return &v }
	obs := []models.Observation{
		// Mine, confirmed: two primary points plus one evolutive, out of order.
		{UserID: mine, IndicatorID: glucose, CollectedAt: day(t, "2026-05-08"), ValueText: "105",
			ValueNum: num(105), Provenance: models.ProvenancePrimary, Status: models.ObservationConfirmed},
		{UserID: mine, IndicatorID: glucose, CollectedAt: day(t, "2024-04-25"), ValueText: "92",
			ValueNum: num(92), Provenance: models.ProvenancePrimary, Status: models.ObservationConfirmed},
		{UserID: mine, IndicatorID: glucose, CollectedAt: day(t, "2025-06-12"), ValueText: "96",
			ValueNum: num(96), Provenance: models.ProvenanceEvolutive, Status: models.ObservationConfirmed},
		// Mine, confirmed but not numeric: counted, listed, never plotted.
		{UserID: mine, IndicatorID: egfr, CollectedAt: day(t, "2026-05-08"), ValueText: ">90",
			Provenance: models.ProvenancePrimary, Status: models.ObservationConfirmed},
		// Mine, still in review: must be invisible everywhere here.
		{UserID: mine, IndicatorID: tsh, CollectedAt: day(t, "2026-05-08"), ValueText: "1,9",
			ValueNum: num(1.9), Provenance: models.ProvenancePrimary, Status: models.ObservationReview},
		// Somebody else's confirmed glucose.
		{UserID: other, IndicatorID: glucose, CollectedAt: day(t, "2026-05-08"), ValueText: "300",
			ValueNum: num(300), Provenance: models.ProvenancePrimary, Status: models.ObservationConfirmed},
	}
	if err := models.ObservationInsertBatch(ctx, database, obs); err != nil {
		t.Fatalf("ObservationInsertBatch: %v", err)
	}

	router := seriesRouter(&handlers.SeriesHandler{DB: database}, mine)

	index := getJSON[[]models.IndicatorSeries](t, router, "/api/health-series")
	byCode := map[string]models.IndicatorSeries{}
	for _, s := range index {
		byCode[s.Code] = s
	}
	if _, ok := byCode["tsh"]; ok {
		t.Error("indicator with only observations in review appears in the index")
	}
	g, ok := byCode["glucose_serum"]
	if !ok {
		t.Fatalf("glucose_serum missing from index: %+v", index)
	}
	if g.Count != 3 || g.NumericCount != 3 {
		t.Errorf("glucose count = %d/%d, want 3/3", g.Count, g.NumericCount)
	}
	if g.LastCollectedAt != "2026-05-08" {
		t.Errorf("lastCollectedAt = %q, want 2026-05-08", g.LastCollectedAt)
	}
	if e := byCode["egfr_ckd_epi_2009_black"]; e.Count != 1 || e.NumericCount != 0 {
		t.Errorf("egfr count = %d/%d, want 1/0 (non-numeric is listed, not plotted)", e.Count, e.NumericCount)
	}

	series := getJSON[[]models.Observation](t, router, "/api/health-series/glucose_serum")
	if len(series) != 3 {
		t.Fatalf("series has %d points, want 3 (other user's value must not leak)", len(series))
	}
	want := []string{"2024-04-25", "2025-06-12", "2026-05-08"}
	for i, o := range series {
		if got := o.CollectedAt.Format("2006-01-02"); got != want[i] {
			t.Errorf("point %d = %s, want %s (series must be ordered by collection date)", i, got, want[i])
		}
		if o.ValueText == "300" {
			t.Error("another user's observation leaked into the series")
		}
	}
	if series[1].Provenance != models.ProvenanceEvolutive {
		t.Errorf("provenance of the 2025 point = %q, want evolutive", series[1].Provenance)
	}

	// An indicator with no confirmed data answers empty, not an error.
	if got := getJSON[[]models.Observation](t, router, "/api/health-series/tsh"); len(got) != 0 {
		t.Errorf("tsh series has %d points, want 0 while still in review", len(got))
	}
}
