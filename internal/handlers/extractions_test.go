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
    {"code":"erythrocytes","collectedAt":"2026-05-08","valueText":"5,40","valueNum":5.40,
     "unit":"milhões/mm3","referenceText":"4,32 a 5,67 milhões/mm3","refMin":null,"refMax":null,
     "outOfRange":null,"provenance":"primary"},
    {"code":"hemoglobin","collectedAt":"2026-05-08","valueText":"16,5","valueNum":16.5,"unit":"g/dL",
     "referenceText":"Masc: 13,3 a 16,5 / Fem: 11,7 a 15,5","refMin":null,"refMax":null,
     "outOfRange":null,"provenance":"primary"},
    {"code":"leukocytes","collectedAt":"2025-06-12","valueText":"8.280(1)","valueNum":null,
     "unit":"/mm3","referenceText":"3.650 a 8.120/mm3","refMin":null,"refMax":null,
     "outOfRange":null,"provenance":"evolutive"},
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
	if len(list) != 8 {
		t.Fatalf("observations = %d, want 8", len(list))
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
	// The model dropped the bounds but sent the literal: they are read off the
	// printed interval, not computed from the value.
	erythrocytes := byCode["erythrocytes|primary"]
	if erythrocytes.RefMin == nil || erythrocytes.RefMax == nil ||
		*erythrocytes.RefMin != 4.32 || *erythrocytes.RefMax != 5.67 {
		t.Errorf("erythrocytes bounds = %v/%v, want 4.32/5.67 derived from %q",
			erythrocytes.RefMin, erythrocytes.RefMax, "4,32 a 5,67 milhões/mm3")
	}
	// A range printed per sex is conditional: text survives, bounds do not.
	hemoglobin := byCode["hemoglobin|primary"]
	if hemoglobin.RefMin != nil || hemoglobin.RefMax != nil {
		t.Errorf("hemoglobin bounds = %v/%v, want nil: the range is conditional by sex",
			hemoglobin.RefMin, hemoglobin.RefMax)
	}
	if hemoglobin.ReferenceText == nil {
		t.Error("hemoglobin lost the printed reference text")
	}

	// The lab glues its marker to the number: "8.280(1)" is 8280 out of range,
	// not a textual result. And the dot groups thousands, so the reference
	// "3.650 a 8.120" is 3650 to 8120, not 3,65 to 8,12.
	leukocytes := byCode["leukocytes|evolutive"]
	if leukocytes.ValueNum == nil || *leukocytes.ValueNum != 8280 {
		t.Errorf("leukocytes valueNum = %v, want 8280 read out of %q",
			leukocytes.ValueNum, leukocytes.ValueText)
	}
	if leukocytes.ValueText != "8.280(1)" {
		t.Errorf("leukocytes valueText = %q, want the literal with the marker", leukocytes.ValueText)
	}
	if leukocytes.OutOfRange == nil || !*leukocytes.OutOfRange {
		t.Errorf("leukocytes outOfRange = %v, want true from the (1) marker", leukocytes.OutOfRange)
	}
	if leukocytes.RefMin == nil || leukocytes.RefMax == nil ||
		*leukocytes.RefMin != 3650 || *leukocytes.RefMax != 8120 {
		t.Errorf("leukocytes bounds = %v/%v, want 3650/8120: the dot groups thousands",
			leukocytes.RefMin, leukocytes.RefMax)
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

// seedUser creates a plain USER, the role that may now extract its own PDFs.
func seedUser(t *testing.T, ctx context.Context, database *sql.DB) string {
	t.Helper()
	id := uuid.New().String()
	if _, err := models.UserCreate(ctx, database, id, models.CreateUserInput{
		Email: id + "@test.com", Name: "Usuária", PasswordHash: "x", Role: "USER", Theme: "SYSTEM",
	}); err != nil {
		t.Fatalf("UserCreate: %v", err)
	}
	return id
}

// userRouter serves the extraction routes under a plain USER session, the way
// RequireAuth does in production now that extraction left the ADMIN group.
func userRouter(h *handlers.ExtractionHandler, userID string) http.Handler {
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth.Manager.Put(r.Context(), auth.SessionKeyUserID, userID)
			auth.Manager.Put(r.Context(), auth.SessionKeyRole, "USER")
			next.ServeHTTP(w, r)
		})
	})
	router.Post("/api/extractions", h.Create)
	router.Get("/api/extractions/{id}", h.Get)
	router.Get("/api/extractions/{id}/review", h.Review)
	router.Post("/api/extractions/{id}/confirm", h.Confirm)
	router.Get("/api/files/{id}/extractions", h.ListByFile)
	router.Delete("/api/files/{id}/extractions", h.ResetFile)
	return wrapWithSession(router)
}

// TestExtraction_UserExtractsOwnDocument covers ADR 0011: a plain USER runs
// the extraction on their own PDF, reviews it and confirms it, and reaches
// nothing that belongs to somebody else.
func TestExtraction_UserExtractsOwnDocument(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	mine := seedUser(t, ctx, database)
	stranger := seedUser(t, ctx, database)
	myFile := seedPDF(t, ctx, database, filesPath, mine)
	theirFile := seedPDF(t, ctx, database, filesPath, stranger)

	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := userRouter(h, mine)

	post := func(url string, body any) *httptest.ResponseRecorder {
		var reader *bytes.Reader
		if body == nil {
			reader = bytes.NewReader(nil)
		} else {
			raw, _ := json.Marshal(body)
			reader = bytes.NewReader(raw)
		}
		req := httptest.NewRequest(http.MethodPost, url, reader)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	// Somebody else's document is invisible, not merely forbidden.
	if w := post("/api/extractions", map[string]any{"fileId": theirFile.ID, "consent": true}); w.Code != http.StatusNotFound {
		t.Fatalf("extracting another user's document = %d, want 404; body: %s", w.Code, w.Body.String())
	}

	w := post("/api/extractions", map[string]any{"fileId": myFile.ID, "consent": true})
	if w.Code != http.StatusAccepted {
		t.Fatalf("USER extracting own document = %d, want 202; body: %s", w.Code, w.Body.String())
	}
	var created struct{ Data models.Extraction }
	json.NewDecoder(w.Body).Decode(&created)
	if created.Data.UserID != mine {
		t.Errorf("extraction owner = %q, want the document owner %q", created.Data.UserID, mine)
	}
	done := waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)

	// The owner reviews and confirms their own block.
	req := httptest.NewRequest(http.MethodGet, "/api/extractions/"+done.ID+"/review", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner review = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	if w := post("/api/extractions/"+done.ID+"/confirm", nil); w.Code != http.StatusOK {
		t.Fatalf("owner confirm = %d, want 200; body: %s", w.Code, w.Body.String())
	}
	series, err := models.ObservationFindSeries(ctx, database, mine, "glucose_serum")
	if err != nil {
		t.Fatal(err)
	}
	if len(series) != 2 {
		t.Errorf("confirmed series = %d, want 2", len(series))
	}

	// A stranger sees none of it, on any extraction-scoped route.
	outsider := userRouter(h, stranger)
	for _, url := range []string{
		"/api/extractions/" + done.ID,
		"/api/extractions/" + done.ID + "/review",
		"/api/files/" + myFile.ID + "/extractions",
	} {
		rec := httptest.NewRecorder()
		outsider.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		if rec.Code != http.StatusNotFound {
			t.Errorf("GET %s as a stranger = %d, want 404", url, rec.Code)
		}
	}
	rec = httptest.NewRecorder()
	outsider.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/api/files/"+myFile.ID+"/extractions", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("stranger reset = %d, want 404", rec.Code)
	}
	var left int
	database.QueryRowContext(ctx, `SELECT COUNT(*) FROM extractions`).Scan(&left)
	if left != 1 {
		t.Errorf("extractions after the stranger's attempt = %d, want 1", left)
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
	if len(res.Observations) != 9 || len(res.Unmapped) != 1 {
		t.Errorf("parsed %d observations and %d unmapped, want 9 and 1", len(res.Observations), len(res.Unmapped))
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
