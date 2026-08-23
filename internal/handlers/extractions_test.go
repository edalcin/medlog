package handlers_test

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	appdb "medlog/internal/db"
	"medlog/internal/gemini"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

// fakeProvider stands in for the Gemini API. It records the request body so
// the test can assert what actually goes over the wire, and answers with the
// real response envelope shape: candidates[].content.parts[].text carrying the
// structured JSON, plus usageMetadata.
type fakeProvider struct {
	server      *httptest.Server
	lastRequest map[string]any
	status      int
	answer      string
	usage       map[string]int
}

func newFakeProvider(t *testing.T, answer string) *fakeProvider {
	t.Helper()
	p := &fakeProvider{
		status: http.StatusOK,
		answer: answer,
		usage:  map[string]int{"promptTokenCount": 6128, "candidatesTokenCount": 9100, "thoughtsTokenCount": 400},
	}
	p.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-goog-api-key") == "" {
			t.Error("provider called without x-goog-api-key header")
		}
		_ = json.NewDecoder(r.Body).Decode(&p.lastRequest)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(p.status)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"candidates": []any{map[string]any{
				"content": map[string]any{"parts": []any{map[string]any{"text": p.answer}}},
			}},
			"usageMetadata": p.usage,
		})
	}))
	t.Cleanup(p.server.Close)
	return p
}

func (p *fakeProvider) client() *gemini.Client {
	return &gemini.Client{APIKey: "test-key", HTTP: p.server.Client(), Endpoint: p.server.URL + "/v1beta/models/%s:generateContent"}
}

// seedPDF writes a PDF-typed file row plus the bytes on disk.
func seedPDF(t *testing.T, ctx context.Context, database *sql.DB, filesPath, userID string) *models.File {
	t.Helper()
	id := uuid.New().String()
	path := filepath.Join(filesPath, id+".pdf")
	if err := os.WriteFile(path, []byte("%PDF-1.7 fake report"), 0o600); err != nil {
		t.Fatalf("write pdf: %v", err)
	}
	f, err := models.FileCreate(ctx, database, models.CreateFileInput{
		ID: id, Filename: id + ".pdf", Path: path,
		MimeType: "application/pdf", Size: 20, UserID: &userID,
	})
	if err != nil {
		t.Fatalf("FileCreate: %v", err)
	}
	return f
}

func seedAdmin(t *testing.T, ctx context.Context, database *sql.DB) string {
	t.Helper()
	id := uuid.New().String()
	if _, err := models.UserCreate(ctx, database, id, models.CreateUserInput{
		Email: id + "@test.com", Name: "Admin", PasswordHash: "x", Role: "ADMIN", Theme: "SYSTEM",
	}); err != nil {
		t.Fatalf("UserCreate: %v", err)
	}
	return id
}

// adminSession issues a request already carrying an ADMIN session, the way
// RequireAdmin expects it in production.
func extractionRouter(h *handlers.ExtractionHandler, userID string) http.Handler {
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth.Manager.Put(r.Context(), auth.SessionKeyUserID, userID)
			auth.Manager.Put(r.Context(), auth.SessionKeyRole, "ADMIN")
			next.ServeHTTP(w, r)
		})
	})
	router.Post("/api/extractions", h.Create)
	router.Get("/api/extractions/{id}", h.Get)
	router.Get("/api/extractions/{id}/observations", h.ListObservations)
	router.Put("/api/admin/gemini-model", h.SetModel)
	return wrapWithSession(router)
}

// answerFixture mirrors the real report: a primary value, an evolutive value
// from an earlier collection, a non-numeric result, a conditional reference
// range with no numeric bounds, and an analyte absent from the catalog.
const answerFixture = `{
  "collectedAt": "2026-05-08",
  "labName": "Clínica Felippe Mattoso",
  "reportNumber": "5580135733",
  "observations": [
    {"code":"glucose_serum","collectedAt":"2026-05-08","valueText":"105","valueNum":105,
     "unit":"mg/dL","referenceText":"70 a 99 mg/dL","refMin":70,"refMax":99,"outOfRange":true,"provenance":"primary"},
    {"code":"glucose_serum","collectedAt":"2025-06-12","valueText":"96","valueNum":96,
     "unit":"mg/dL","referenceText":"70 a 99 mg/dL","refMin":70,"refMax":99,"outOfRange":false,"provenance":"evolutive"},
    {"code":"egfr_ckd_epi_2009_black","collectedAt":"2026-05-08","valueText":">90","valueNum":null,
     "unit":"mL/min/1,73 m2","referenceText":"Superior a 60 mL/min/1,73 m2","refMin":null,"refMax":null,
     "outOfRange":false,"provenance":"primary"},
    {"code":"tsh","collectedAt":"2026-05-08","valueText":"1,9","valueNum":1.9,"unit":"mUI/L",
     "referenceText":"Depende da faixa etária do paciente","refMin":null,"refMax":null,
     "outOfRange":null,"provenance":"primary"},
    {"code":"red_cell_morphology","collectedAt":"2026-05-08","valueText":"normais","valueNum":null,
     "unit":"","referenceText":"","refMin":null,"refMax":null,"outOfRange":null,"provenance":"primary"},
    {"code":"nao_existe_no_catalogo","collectedAt":"2026-05-08","valueText":"42","valueNum":42,
     "unit":"","referenceText":"","refMin":null,"refMax":null,"outOfRange":null,"provenance":"primary"}
  ],
  "unmapped": [
    {"label":"ANALITO DESCONHECIDO","collectedAt":"2026-05-08","valueText":"42","unit":"","referenceText":""}
  ]
}`

// waitForStatus polls the extraction row, since the provider call runs in a
// goroutine detached from the request (ADR 0006).
func waitForStatus(t *testing.T, database *sql.DB, id, want string) *models.Extraction {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		e, err := models.ExtractionFindByID(context.Background(), database, id)
		if err != nil {
			t.Fatalf("ExtractionFindByID: %v", err)
		}
		if e.Status == want {
			return e
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("extraction %s never reached status %q", id, want)
	return nil
}

func TestExtraction_EndToEnd(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := extractionRouter(h, adminID)

	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202; body: %s", w.Code, w.Body.String())
	}
	var created struct{ Data models.Extraction }
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// The row exists before the provider answers: a crash leaves evidence.
	if created.Data.Status != models.ExtractionPending {
		t.Errorf("initial status = %q, want pending", created.Data.Status)
	}
	if created.Data.PromptVersion != gemini.PromptVersion || created.Data.SchemaVersion != gemini.SchemaVersion {
		t.Errorf("versions = %q/%q, want %q/%q", created.Data.PromptVersion, created.Data.SchemaVersion,
			gemini.PromptVersion, gemini.SchemaVersion)
	}

	done := waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)

	// Thinking tokens are billed as output, so they must be included.
	if done.InputTokens == nil || *done.InputTokens != 6128 {
		t.Errorf("inputTokens = %v, want 6128", done.InputTokens)
	}
	if done.OutputTokens == nil || *done.OutputTokens != 9500 {
		t.Errorf("outputTokens = %v, want 9500 (candidates + thoughts)", done.OutputTokens)
	}

	// The raw response is persisted verbatim, so a parsing fix costs nothing.
	raw, err := models.ExtractionRawResponse(ctx, database, done.ID)
	if err != nil {
		t.Fatalf("raw response: %v", err)
	}
	if !strings.Contains(raw, "usageMetadata") || !strings.Contains(raw, "glucose_serum") {
		t.Errorf("raw response not stored verbatim: %.120s", raw)
	}

	// Structured output was requested with the schema declared in Go.
	cfg, ok := provider.lastRequest["generationConfig"].(map[string]any)
	if !ok {
		t.Fatal("request carried no generationConfig")
	}
	if cfg["responseMimeType"] != "application/json" {
		t.Errorf("responseMimeType = %v, want application/json", cfg["responseMimeType"])
	}
	if cfg["responseSchema"] == nil {
		t.Error("request carried no responseSchema")
	}
	// The prompt offers the closed catalog, and the PDF goes inline.
	sent, _ := json.Marshal(provider.lastRequest)
	if !strings.Contains(string(sent), "glucose_serum | Glicose, soro | mg/dL") {
		t.Error("prompt did not offer the catalog codes")
	}
	if !strings.Contains(string(sent), "inlineData") {
		t.Error("PDF was not sent inline")
	}

	// Five of six observations map; the unknown code is skipped, never
	// auto-created, and the catalog keeps its seeded size.
	list, err := models.ObservationFindByExtraction(ctx, database, done.ID)
	if err != nil {
		t.Fatalf("ObservationFindByExtraction: %v", err)
	}
	if len(list) != 5 {
		t.Fatalf("observations = %d, want 5", len(list))
	}
	catalog, err := models.IndicatorFindAll(ctx, database)
	if err != nil {
		t.Fatalf("IndicatorFindAll: %v", err)
	}
	if len(catalog) != 55 {
		t.Errorf("catalog grew to %d, want 55: extraction must never create indicators", len(catalog))
	}

	byCode := map[string]models.Observation{}
	for _, o := range list {
		if o.Status != models.ObservationReview {
			t.Errorf("%s born with status %q, want review", o.IndicatorCode, o.Status)
		}
		byCode[o.IndicatorCode+"|"+o.Provenance] = o
	}

	// ">90" keeps its text and stays out of the numeric column.
	egfr := byCode["egfr_ckd_epi_2009_black|primary"]
	if egfr.ValueText != ">90" || egfr.ValueNum != nil {
		t.Errorf("egfr = %q/%v, want \">90\"/nil", egfr.ValueText, egfr.ValueNum)
	}
	// A conditional range yields text only, no numeric bounds.
	tsh := byCode["tsh|primary"]
	if tsh.RefMin != nil || tsh.RefMax != nil || tsh.ReferenceText == nil {
		t.Errorf("tsh bounds = %v/%v, text = %v; want nil bounds with text", tsh.RefMin, tsh.RefMax, tsh.ReferenceText)
	}
	// The evolutive table lands as its own dated observation.
	evolutive := byCode["glucose_serum|evolutive"]
	if got := evolutive.CollectedAt.Format("2006-01-02"); got != "2025-06-12" {
		t.Errorf("evolutive collectedAt = %s, want 2025-06-12", got)
	}
	// out_of_range comes from the lab marker, including the false case.
	if evolutive.OutOfRange == nil || *evolutive.OutOfRange {
		t.Errorf("evolutive outOfRange = %v, want false", evolutive.OutOfRange)
	}
	primary := byCode["glucose_serum|primary"]
	if primary.OutOfRange == nil || !*primary.OutOfRange {
		t.Errorf("primary outOfRange = %v, want true", primary.OutOfRange)
	}
	// A missing unit falls back to the catalog's canonical unit.
	morphology := byCode["red_cell_morphology|primary"]
	if morphology.Unit != nil {
		t.Errorf("morphology unit = %v, want nil (catalog has none)", *morphology.Unit)
	}

	// Nothing is visible as a series until confirmed.
	series, err := models.ObservationFindSeries(ctx, database, adminID, "glucose_serum")
	if err != nil {
		t.Fatalf("ObservationFindSeries: %v", err)
	}
	if len(series) != 0 {
		t.Errorf("confirmed series = %d, want 0 before review", len(series))
	}
}

func TestExtraction_RequiresConsent(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}

	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": false})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	extractionRouter(h, adminID).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400: no consent, no send", w.Code)
	}
	if provider.lastRequest != nil {
		t.Error("document was sent to the provider without consent")
	}
}

func TestExtraction_ProviderErrorKeepsRawAnswer(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	provider.status = http.StatusTooManyRequests
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}

	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	extractionRouter(h, adminID).ServeHTTP(w, req)

	var created struct{ Data models.Extraction }
	json.NewDecoder(w.Body).Decode(&created)
	failed := waitForStatus(t, database, created.Data.ID, models.ExtractionFailed)

	if failed.Error == nil || !strings.Contains(*failed.Error, "429") {
		t.Errorf("error = %v, want the provider status", failed.Error)
	}
	raw, _ := models.ExtractionRawResponse(ctx, database, failed.ID)
	if raw == "" {
		t.Error("raw answer discarded on failure: it was already paid for")
	}
	list, _ := models.ObservationFindByExtraction(ctx, database, failed.ID)
	if len(list) != 0 {
		t.Errorf("observations = %d, want 0 on failure", len(list))
	}
}

func TestExtraction_ReparseRawWithoutCallingProvider(t *testing.T) {
	provider := newFakeProvider(t, answerFixture)
	raw, err := json.Marshal(map[string]any{
		"candidates": []any{map[string]any{
			"content": map[string]any{"parts": []any{map[string]any{"text": answerFixture}}},
		}},
		"usageMetadata": provider.usage,
	})
	if err != nil {
		t.Fatal(err)
	}
	res, usage, err := gemini.ParseRaw(string(raw))
	if err != nil {
		t.Fatalf("ParseRaw: %v", err)
	}
	if len(res.Observations) != 6 || len(res.Unmapped) != 1 {
		t.Errorf("parsed %d observations and %d unmapped, want 6 and 1", len(res.Observations), len(res.Unmapped))
	}
	if usage.OutputTokens != 9500 {
		t.Errorf("outputTokens = %d, want 9500", usage.OutputTokens)
	}
	if provider.lastRequest != nil {
		t.Error("reparsing must not call the provider")
	}
}

func TestExtraction_ModelSelectionRejectsUnknown(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()

	adminID := seedAdmin(t, ctx, database)
	h := &handlers.ExtractionHandler{DB: database, Client: gemini.New("k")}
	router := extractionRouter(h, adminID)

	body, _ := json.Marshal(map[string]string{"model": "gemini-3.1-pro-preview"})
	req := httptest.NewRequest(http.MethodPut, "/api/admin/gemini-model", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 for a model outside the curated list", w.Code)
	}

	body, _ = json.Marshal(map[string]string{"model": "gemini-3.7-flash"})
	req = httptest.NewRequest(http.MethodPut, "/api/admin/gemini-model", bytes.NewReader(body))
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
	}
	got, err := models.ConfigGet(ctx, database, handlers.ConfigKeyGeminiModel, gemini.DefaultModel)
	if err != nil {
		t.Fatal(err)
	}
	if got != "gemini-3.7-flash" {
		t.Errorf("stored model = %q, want gemini-3.7-flash", got)
	}
}

func TestExtraction_StalePendingIsFailedOnStartup(t *testing.T) {
	database := appdb.SetupTestDB(t)
	ctx := context.Background()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, t.TempDir(), adminID)
	e, err := models.ExtractionCreate(ctx, database, adminID, file.ID, adminID,
		gemini.DefaultModel, gemini.PromptVersion, gemini.SchemaVersion, time.Now().UTC())
	if err != nil {
		t.Fatalf("ExtractionCreate: %v", err)
	}

	n, err := models.ExtractionMarkStale(ctx, database)
	if err != nil {
		t.Fatalf("ExtractionMarkStale: %v", err)
	}
	if n != 1 {
		t.Errorf("marked %d, want 1", n)
	}
	after, err := models.ExtractionFindByID(ctx, database, e.ID)
	if err != nil {
		t.Fatal(err)
	}
	if after.Status != models.ExtractionFailed {
		t.Errorf("status = %q, want failed: a goroutine cannot survive a restart", after.Status)
	}
}
