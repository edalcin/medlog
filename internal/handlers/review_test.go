package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"medlog/internal/auth"
	appdb "medlog/internal/db"
	"medlog/internal/gemini"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

func reviewRouter(h *handlers.ExtractionHandler, userID string) http.Handler {
	router := chi.NewRouter()
	router.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth.Manager.Put(r.Context(), auth.SessionKeyUserID, userID)
			auth.Manager.Put(r.Context(), auth.SessionKeyRole, "ADMIN")
			next.ServeHTTP(w, r)
		})
	})
	router.Post("/api/extractions", h.Create)
	router.Get("/api/extractions/{id}/review", h.Review)
	router.Post("/api/extractions/{id}/confirm", h.Confirm)
	router.Post("/api/extractions/{id}/reject", h.Reject)
	router.Post("/api/health-indicators", h.PromoteIndicator)
	router.Delete("/api/files/{id}/extractions", h.ResetFile)
	return wrapWithSession(router)
}

// metaField mirrors the review payload's metadata entry. Declared here on
// purpose: the handler type is unexported, and the test asserts the JSON
// contract the frontend actually consumes.
type metaField struct {
	Field     string `json:"field"`
	Label     string `json:"label"`
	Suggested string `json:"suggested"`
	Current   string `json:"current"`
	Divergent bool   `json:"divergent"`
	WillBeSet bool   `json:"willBeSet"`
}

func TestReview_ConfirmPromotesBlockAndFillsMetadata(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	// Trigger and wait.
	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var created struct{ Data models.Extraction }
	json.NewDecoder(w.Body).Decode(&created)
	waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)
	id := created.Data.ID

	// Review payload carries observations, pending analytes and metadata.
	req = httptest.NewRequest(http.MethodGet, "/api/extractions/"+id+"/review", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("review status = %d; body: %s", w.Code, w.Body.String())
	}
	var review struct {
		Data struct {
			Observations []models.Observation `json:"observations"`
			Unmapped     []gemini.Unmapped    `json:"unmapped"`
			Metadata     []metaField          `json:"metadata"`
		}
	}
	if err := json.NewDecoder(w.Body).Decode(&review); err != nil {
		t.Fatalf("decode review: %v", err)
	}
	if len(review.Data.Observations) != 8 {
		t.Errorf("observations = %d, want 8", len(review.Data.Observations))
	}
	if len(review.Data.Unmapped) != 1 {
		t.Errorf("unmapped = %d, want 1", len(review.Data.Unmapped))
	}
	byField := map[string]metaField{}
	for _, f := range review.Data.Metadata {
		byField[f.Field] = f
	}
	if got := byField["collectedAt"]; got.Suggested != "2026-05-08" || !got.WillBeSet {
		t.Errorf("collectedAt = %+v, want suggested 2026-05-08 and willBeSet", got)
	}
	if got := byField["labName"]; got.Suggested != "Clínica Felippe Mattoso" {
		t.Errorf("labName suggested = %q", got.Suggested)
	}

	// Confirming the block promotes every observation and fills the document.
	req = httptest.NewRequest(http.MethodPost, "/api/extractions/"+id+"/confirm", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("confirm status = %d; body: %s", w.Code, w.Body.String())
	}
	var confirmed struct {
		Data struct {
			Confirmed       int      `json:"confirmed"`
			MetadataApplied []string `json:"metadataApplied"`
		}
	}
	json.NewDecoder(w.Body).Decode(&confirmed)
	if confirmed.Data.Confirmed != 8 {
		t.Errorf("confirmed = %d, want 8", confirmed.Data.Confirmed)
	}
	if len(confirmed.Data.MetadataApplied) != 4 {
		t.Errorf("metadataApplied = %v, want all four fields", confirmed.Data.MetadataApplied)
	}

	after, err := models.FileFindByID(ctx, database, file.ID)
	if err != nil {
		t.Fatalf("FileFindByID: %v", err)
	}
	if after.CollectedAt == nil || after.CollectedAt.Format("2006-01-02") != "2026-05-08" {
		t.Errorf("file collectedAt = %v, want 2026-05-08", after.CollectedAt)
	}
	if after.LabName == nil || *after.LabName != "Clínica Felippe Mattoso" {
		t.Errorf("file labName = %v", after.LabName)
	}
	if after.ReportNumber == nil || *after.ReportNumber != "5580135733" {
		t.Errorf("file reportNumber = %v", after.ReportNumber)
	}
	if after.CustomName == nil || *after.CustomName != "Exame de sangue — 08/05/2026" {
		t.Errorf("file customName = %v", after.CustomName)
	}

	// Only now does the series exist.
	series, err := models.ObservationFindSeries(ctx, database, adminID, "glucose_serum")
	if err != nil {
		t.Fatalf("ObservationFindSeries: %v", err)
	}
	if len(series) != 2 {
		t.Errorf("confirmed series = %d, want 2 (primary + evolutive)", len(series))
	}
}

// TestReview_ReExtractionDoesNotDuplicate guards the unique index that backs
// ADR 0003. It compares (user_id, indicator_id, collected_at, provenance) as
// stored text, so it only holds while every datetime is written in one format.
// modernc.org/sqlite with _time_format=sqlite always writes UTC as
// "...+00:00"; if that ever changes per code path, re-extraction silently
// duplicates instead of replacing.
func TestReview_ReExtractionDoesNotDuplicate(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	extract := func() string {
		body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
		req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		var created struct{ Data models.Extraction }
		json.NewDecoder(w.Body).Decode(&created)
		waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)
		return created.Data.ID
	}

	first := extract()
	second := extract()
	if first == second {
		t.Fatal("second extraction reused the first row")
	}

	var total int
	if err := database.QueryRowContext(ctx, `SELECT COUNT(*) FROM health_observations`).Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != 8 {
		t.Errorf("observations = %d, want 8: re-extraction must replace, not duplicate", total)
	}

	// The surviving rows belong to the newest extraction.
	list, err := models.ObservationFindByExtraction(ctx, database, second)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 8 {
		t.Errorf("newest extraction owns %d observations, want 8", len(list))
	}
	old, err := models.ObservationFindByExtraction(ctx, database, first)
	if err != nil {
		t.Fatal(err)
	}
	if len(old) != 0 {
		t.Errorf("old extraction still owns %d observations", len(old))
	}
}

// TestReview_NewExtractionSupersedesLeftoverReview covers what the first real
// use exposed: a second extraction of the same document left the observations
// of the first one behind, in review, so the document stayed flagged as
// pending even after the newest block was confirmed.
func TestReview_NewExtractionSupersedesLeftoverReview(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	extract := func() string {
		body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
		req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		var created struct{ Data models.Extraction }
		json.NewDecoder(w.Body).Decode(&created)
		waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)
		return created.Data.ID
	}

	// A confirmed observation from an earlier session, on the same document,
	// that neither run re-extracts. It must survive the superseding.
	tsh := indicatorID(t, database, "tsh")
	fileID := file.ID
	if err := models.ObservationInsertBatch(ctx, database, []models.Observation{{
		UserID: adminID, IndicatorID: tsh, SourceFileID: &fileID,
		CollectedAt: day(t, "2023-03-27"), ValueText: "1,9",
		Provenance: models.ProvenancePrimary, Status: models.ObservationConfirmed,
	}}); err != nil {
		t.Fatalf("seed confirmed observation: %v", err)
	}

	// The first block is left in review, exactly as it happened in real use.
	first := extract()

	// The second run answers with less than the first: only glucose comes back.
	provider.answer = answerFixtureSlim
	second := extract()

	count := func(query string, args ...any) int {
		var n int
		if err := database.QueryRowContext(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	// Only what the newest run produced is pending. The five observations the
	// first run left behind are gone: nobody accepted that answer.
	if got := count(`SELECT COUNT(*) FROM health_observations WHERE status='review'`); got != 2 {
		t.Errorf("observations in review = %d, want 2 (only what the newest run produced)", got)
	}
	if got := count(`SELECT COUNT(*) FROM health_observations WHERE status='review' AND extraction_id <> ?`,
		second); got != 0 {
		t.Errorf("%d review observations still belong to a superseded extraction", got)
	}
	if got := count(`SELECT COUNT(*) FROM health_observations WHERE status='confirmed'`); got != 1 {
		t.Errorf("confirmed observations = %d, want 1: superseding must never delete confirmed data", got)
	}
	// One document keeps one extraction: the superseded row is gone.
	if got := count(`SELECT COUNT(*) FROM extractions WHERE file_id = ?`, file.ID); got != 1 {
		t.Errorf("extractions on the document = %d, want 1", got)
	}
	if got := count(`SELECT COUNT(*) FROM extractions WHERE id = ?`, first); got != 0 {
		t.Error("the superseded extraction row survived")
	}

	// The document flag the file list reads comes from this count.
	if got := count(`SELECT COUNT(*) FROM health_observations WHERE source_file_id=? AND status='review'`,
		file.ID); got != 2 {
		t.Errorf("file review count = %d, want 2", got)
	}
}

// answerFixtureSlim is a second answer for the same document that returns
// fewer analytes, the way a different model or a changed prompt does.
const answerFixtureSlim = `{
  "collectedAt": "2026-05-08",
  "labName": "Clínica Felippe Mattoso",
  "reportNumber": "5580135733",
  "observations": [
    {"code":"glucose_serum","collectedAt":"2026-05-08","valueText":"105","valueNum":105,
     "unit":"mg/dL","referenceText":"70 a 99 mg/dL","refMin":70,"refMax":99,"outOfRange":true,"provenance":"primary"},
    {"code":"glucose_serum","collectedAt":"2025-06-12","valueText":"96","valueNum":96,
     "unit":"mg/dL","referenceText":"70 a 99 mg/dL","refMin":70,"refMax":99,"outOfRange":false,"provenance":"evolutive"}
  ],
  "unmapped": []
}`

// answerFixtureOtherDoc belongs to a different document and a different
// collection, so it shares no observation key with answerFixture.
const answerFixtureOtherDoc = `{
  "collectedAt": "2019-01-10",
  "labName": "Clínica Felippe Mattoso",
  "reportNumber": "1000000001",
  "observations": [
    {"code":"glucose_serum","collectedAt":"2019-01-10","valueText":"88","valueNum":88,
     "unit":"mg/dL","referenceText":"70 a 99 mg/dL","refMin":70,"refMax":99,"outOfRange":false,"provenance":"primary"}
  ],
  "unmapped": []
}`

// TestReview_ResetFileStartsFromScratch covers the deliberate restart: wiping
// a document clean before trying another model, confirmed values included.
func TestReview_ResetFileStartsFromScratch(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	other := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	extract := func(fileID string) string {
		body, _ := json.Marshal(map[string]any{"fileId": fileID, "consent": true})
		req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		var created struct{ Data models.Extraction }
		json.NewDecoder(w.Body).Decode(&created)
		waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)
		return created.Data.ID
	}

	// The other document covers a different collection date on purpose: the
	// unique key is (user, indicator, date, provenance) and ignores the
	// document, so identical answers on two files collapse into one row.
	provider.answer = answerFixtureOtherDoc
	untouched := extract(other.ID)
	provider.answer = answerFixture
	target := extract(file.ID)

	// Confirm the target block, so the reset has confirmed data to erase.
	req := httptest.NewRequest(http.MethodPost, "/api/extractions/"+target+"/confirm", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("confirm status = %d; body: %s", w.Code, w.Body.String())
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/files/"+file.ID+"/extractions", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("reset status = %d; body: %s", w.Code, w.Body.String())
	}
	var reset struct {
		Data struct {
			Observations int `json:"observations"`
			Extractions  int `json:"extractions"`
		}
	}
	json.NewDecoder(w.Body).Decode(&reset)
	if reset.Data.Observations != 8 || reset.Data.Extractions != 1 {
		t.Errorf("reset removed %d observations and %d extractions, want 8 and 1",
			reset.Data.Observations, reset.Data.Extractions)
	}

	count := func(query string, args ...any) int {
		var n int
		if err := database.QueryRowContext(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	if got := count(`SELECT COUNT(*) FROM health_observations WHERE source_file_id = ?`, file.ID); got != 0 {
		t.Errorf("%d observations survived the reset", got)
	}
	if got := count(`SELECT COUNT(*) FROM extractions WHERE file_id = ?`, file.ID); got != 0 {
		t.Errorf("%d extractions survived the reset", got)
	}
	// The document is untouched otherwise, and so is every other document.
	if got := count(`SELECT COUNT(*) FROM files WHERE id = ?`, file.ID); got != 1 {
		t.Error("reset deleted the document itself")
	}
	if got := count(`SELECT COUNT(*) FROM extractions WHERE id = ?`, untouched); got != 1 {
		t.Error("reset reached another document's extraction")
	}
	if got := count(`SELECT COUNT(*) FROM health_observations WHERE source_file_id = ?`, other.ID); got != 1 {
		t.Errorf("another document lost observations: %d left, want 1", got)
	}
}

func TestReview_ConfirmNeverOverwritesHumanMetadata(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)

	// A human named the document before any extraction ran.
	human := "Meu exame anual"
	if _, err := database.ExecContext(ctx, `UPDATE files SET custom_name=?, lab_name=? WHERE id=?`,
		human, "Laboratório digitado à mão", file.ID); err != nil {
		t.Fatalf("seed human metadata: %v", err)
	}

	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var created struct{ Data models.Extraction }
	json.NewDecoder(w.Body).Decode(&created)
	waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)

	// Review must flag the divergence instead of hiding it.
	req = httptest.NewRequest(http.MethodGet, "/api/extractions/"+created.Data.ID+"/review", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var review struct {
		Data struct {
			Metadata []metaField `json:"metadata"`
		}
	}
	json.NewDecoder(w.Body).Decode(&review)
	for _, f := range review.Data.Metadata {
		if f.Field == "labName" && !f.Divergent {
			t.Error("labName divergence not reported")
		}
		if f.Field == "labName" && f.WillBeSet {
			t.Error("labName marked as willBeSet over a human value")
		}
	}

	req = httptest.NewRequest(http.MethodPost, "/api/extractions/"+created.Data.ID+"/confirm", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("confirm status = %d", w.Code)
	}

	after, _ := models.FileFindByID(ctx, database, file.ID)
	if after.CustomName == nil || *after.CustomName != human {
		t.Errorf("customName = %v, want the human value preserved", after.CustomName)
	}
	if after.LabName == nil || *after.LabName != "Laboratório digitado à mão" {
		t.Errorf("labName = %v, want the human value preserved", after.LabName)
	}
	// The empty field was still filled.
	if after.ReportNumber == nil || *after.ReportNumber != "5580135733" {
		t.Errorf("reportNumber = %v, want filled", after.ReportNumber)
	}
}

func TestReview_RejectDiscardsObservationsKeepsExtraction(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixture)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var created struct{ Data models.Extraction }
	json.NewDecoder(w.Body).Decode(&created)
	waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)
	id := created.Data.ID

	req = httptest.NewRequest(http.MethodPost, "/api/extractions/"+id+"/reject", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("reject status = %d; body: %s", w.Code, w.Body.String())
	}

	list, _ := models.ObservationFindByExtraction(ctx, database, id)
	if len(list) != 0 {
		t.Errorf("observations = %d, want 0 after rejection", len(list))
	}
	// The extraction and its raw answer survive: still auditable.
	e, err := models.ExtractionFindByID(ctx, database, id)
	if err != nil {
		t.Fatalf("extraction gone after rejection: %v", err)
	}
	if e.Status != models.ExtractionSucceeded {
		t.Errorf("status = %q, want succeeded", e.Status)
	}
	raw, _ := models.ExtractionRawResponse(ctx, database, id)
	if raw == "" {
		t.Error("raw answer discarded on rejection")
	}
	// Metadata must not have been written by a rejection.
	after, _ := models.FileFindByID(ctx, database, file.ID)
	if after.CollectedAt != nil {
		t.Errorf("collectedAt written by a rejected extraction: %v", after.CollectedAt)
	}
}

func TestReview_PromoteIndicatorIsExplicit(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()

	adminID := seedAdmin(t, ctx, database)
	h := &handlers.ExtractionHandler{DB: database, Client: gemini.New("k")}
	router := reviewRouter(h, adminID)

	body, _ := json.Marshal(map[string]string{"code": "ferritin_serum", "name": "Ferritina, soro", "unit": "ng/mL"})
	req := httptest.NewRequest(http.MethodPost, "/api/health-indicators", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("promote status = %d; body: %s", w.Code, w.Body.String())
	}

	catalog, _ := models.IndicatorFindAll(ctx, database)
	if len(catalog) != 56 {
		t.Errorf("catalog = %d, want 56 after promotion", len(catalog))
	}

	// A duplicate code is refused by the UNIQUE constraint, not silently merged.
	req = httptest.NewRequest(http.MethodPost, "/api/health-indicators", bytes.NewReader(body))
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Errorf("duplicate promote status = %d, want 409", w.Code)
	}
}

// answerFixtureNoUnmapped omits the "unmapped" key entirely, the way a model
// answers when every analyte maps to the catalog. Go unmarshals a missing
// JSON array into a nil slice, and a nil slice marshals back out as JSON
// null, not []. The frontend's ExtractionReview.svelte does
// review.unmapped.forEach(...) with no null guard, so a null here crashes
// the review screen outright.
const answerFixtureNoUnmapped = `{
  "collectedAt": "2026-05-08",
  "labName": "Clínica Felippe Mattoso",
  "reportNumber": "5580135733",
  "observations": [
    {"code":"glucose_serum","collectedAt":"2026-05-08","valueText":"105","valueNum":105,
     "unit":"mg/dL","referenceText":"70 a 99 mg/dL","refMin":70,"refMax":99,"outOfRange":true,"provenance":"primary"}
  ]
}`

// TestReview_UnmappedNeverSerializesAsNull guards the exact bug a user hit:
// "Cannot read properties of null (reading 'forEach')" on the review screen.
// It happens whenever the model's raw answer has no "unmapped" array — Go's
// nil-slice-marshals-to-null footgun leaks straight into the API contract.
func TestReview_UnmappedNeverSerializesAsNull(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	ctx := context.Background()
	filesPath := t.TempDir()

	adminID := seedAdmin(t, ctx, database)
	file := seedPDF(t, ctx, database, filesPath, adminID)
	provider := newFakeProvider(t, answerFixtureNoUnmapped)
	h := &handlers.ExtractionHandler{DB: database, FilesPath: filesPath, Client: provider.client()}
	router := reviewRouter(h, adminID)

	body, _ := json.Marshal(map[string]any{"fileId": file.ID, "consent": true})
	req := httptest.NewRequest(http.MethodPost, "/api/extractions", bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var created struct{ Data models.Extraction }
	json.NewDecoder(w.Body).Decode(&created)
	waitForStatus(t, database, created.Data.ID, models.ExtractionSucceeded)

	req = httptest.NewRequest(http.MethodGet, "/api/extractions/"+created.Data.ID+"/review", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("review status = %d; body: %s", w.Code, w.Body.String())
	}
	raw := w.Body.String()
	if strings.Contains(raw, `"unmapped":null`) {
		t.Fatalf("review JSON has unmapped:null, want []: %s", raw)
	}
	if !strings.Contains(raw, `"unmapped":[]`) {
		t.Errorf("review JSON missing unmapped:[], got: %s", raw)
	}
}
