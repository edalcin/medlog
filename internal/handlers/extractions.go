package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"medlog/internal/auth"
	"medlog/internal/gemini"
	"medlog/internal/models"
)

// ConfigKeyGeminiModel is the app_config key holding the chosen model. The API
// key itself never lands in the database: it stays in the environment.
const ConfigKeyGeminiModel = "gemini_model"

// ExtractionHandler drives AI extraction. Every route it serves is ADMIN-only:
// the API key is a server-wide credential and each call costs money.
type ExtractionHandler struct {
	DB        *sql.DB
	FilesPath string
	Client    *gemini.Client
}

// AvailableModels is the short curated list offered by the admin UI, with the
// measured cost of one 16-page report. Declared in Go on purpose: the provider
// lists dozens of models irrelevant here, none validated against a lab report.
var AvailableModels = []struct {
	Model            string `json:"model"`
	Label            string `json:"label"`
	CostPerReportUSD string `json:"costPerReportUsd"`
}{
	{"gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite", "0.021"},
	{"gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", "0.035"},
	{"gemini-3.7-flash", "Gemini 3.7 Flash", "0.054"},
	{"gemini-3.5-flash", "Gemini 3.5 Flash", "0.127"},
}

type createExtractionRequest struct {
	FileID  string `json:"fileId"`
	Consent bool   `json:"consent"`
}

// Create records the consent, persists the extraction, and starts the call in
// a goroutine. It returns immediately: the provider call takes minutes, and
// the frontend aborts every fetch at 30s.
func (h *ExtractionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var in createExtractionRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, "corpo inválido", http.StatusBadRequest)
		return
	}
	if in.FileID == "" {
		writeError(w, "fileId é obrigatório", http.StatusBadRequest)
		return
	}
	// The consent is per document and explicit: without it the PDF, with the
	// patient name and birth date in it, is never sent to a third party.
	if !in.Consent {
		writeError(w, "consentimento explícito é obrigatório para enviar o documento ao provedor de IA", http.StatusBadRequest)
		return
	}

	file, err := models.FileFindByID(r.Context(), h.DB, in.FileID)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && file == nil) {
		writeError(w, "documento não encontrado", http.StatusNotFound)
		return
	}
	if err != nil {
		writeDBError(w, err)
		return
	}
	if file.MimeType != "application/pdf" {
		writeError(w, "somente PDF pode ser extraído", http.StatusBadRequest)
		return
	}
	if file.UserID == nil {
		writeError(w, "documento sem proprietário", http.StatusBadRequest)
		return
	}

	model, err := models.ConfigGet(r.Context(), h.DB, ConfigKeyGeminiModel, gemini.DefaultModel)
	if err != nil {
		writeDBError(w, err)
		return
	}

	triggeredBy := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	extraction, err := models.ExtractionCreate(r.Context(), h.DB, *file.UserID, file.ID, triggeredBy,
		model, gemini.PromptVersion, gemini.SchemaVersion, time.Now().UTC())
	if err != nil {
		writeDBError(w, err)
		return
	}

	// Detached from the request context on purpose: the client hanging up must
	// not cancel a call that is already being billed.
	go h.run(context.Background(), *extraction, file.Path)

	writeJSON(w, http.StatusAccepted, map[string]any{"data": extraction})
}

// run performs the provider call outside any transaction, persists the raw
// response before interpreting it, and only then writes observations.
func (h *ExtractionHandler) run(ctx context.Context, e models.Extraction, path string) {
	log := slog.With("extraction", e.ID, "file", e.FileID, "model", e.Model)

	pdf, err := os.ReadFile(path)
	if err != nil {
		h.fail(ctx, e.ID, "documento ilegível no disco: "+err.Error(), "", nil, nil)
		log.Error("read pdf", "err", err)
		return
	}

	catalog, err := models.IndicatorFindAll(ctx, h.DB)
	if err != nil {
		h.fail(ctx, e.ID, "catálogo indisponível: "+err.Error(), "", nil, nil)
		log.Error("load catalog", "err", err)
		return
	}
	offered := make([]gemini.Indicator, 0, len(catalog))
	for _, i := range catalog {
		unit := ""
		if i.Unit != nil {
			unit = *i.Unit
		}
		offered = append(offered, gemini.Indicator{Code: i.Code, Name: i.Name, Unit: unit})
	}

	raw, result, usage, err := h.Client.Extract(ctx, e.Model, pdf, offered)
	in, out := usage.InputTokens, usage.OutputTokens
	if err != nil {
		// The raw answer is kept even on failure: it was already paid for.
		h.fail(ctx, e.ID, err.Error(), raw, &in, &out)
		log.Error("gemini extract", "err", err, "inputTokens", in, "outputTokens", out)
		return
	}

	// Raw response first, interpretation second (ADR 0006): a parsing bug is
	// then fixable without paying for the extraction again.
	if err := models.ExtractionSucceed(ctx, h.DB, e.ID, raw, in, out); err != nil {
		log.Error("persist raw response", "err", err)
		return
	}

	observations, skipped := buildObservations(e, catalog, result)
	if err := models.ObservationInsertBatch(ctx, h.DB, observations); err != nil {
		log.Error("insert observations", "err", err)
		return
	}
	log.Info("extraction done",
		"observations", len(observations), "skipped", skipped,
		"unmapped", len(result.Unmapped), "inputTokens", in, "outputTokens", out)
}

func (h *ExtractionHandler) fail(ctx context.Context, id, reason, raw string, in, out *int) {
	if err := models.ExtractionFail(ctx, h.DB, id, reason, raw, in, out); err != nil {
		slog.Error("mark extraction failed", "extraction", id, "err", err)
	}
}

// buildObservations maps the provider answer onto catalog rows. A code the
// catalog does not have is skipped, never auto-created: promoting a code is an
// ADMIN decision. Observations are born in review.
func buildObservations(e models.Extraction, catalog []models.Indicator, res *gemini.Result) ([]models.Observation, int) {
	byCode := make(map[string]models.Indicator, len(catalog))
	for _, i := range catalog {
		byCode[i.Code] = i
	}

	fileID := e.FileID
	extractionID := e.ID
	list := make([]models.Observation, 0, len(res.Observations))
	skipped := 0

	for _, o := range res.Observations {
		indicator, ok := byCode[o.Code]
		if !ok {
			skipped++
			continue
		}
		collectedAt, err := parseCollectedAt(o.CollectedAt, res.CollectedAt)
		if err != nil {
			skipped++
			continue
		}
		if o.Provenance != models.ProvenancePrimary && o.Provenance != models.ProvenanceEvolutive {
			skipped++
			continue
		}
		if strings.TrimSpace(o.ValueText) == "" {
			skipped++
			continue
		}
		list = append(list, models.Observation{
			UserID:        e.UserID,
			IndicatorID:   indicator.ID,
			SourceFileID:  &fileID,
			ExtractionID:  &extractionID,
			CollectedAt:   collectedAt,
			ValueText:     o.ValueText,
			ValueNum:      o.ValueNum,
			Unit:          textOrCanonical(o.Unit, indicator.Unit),
			ReferenceText: textOrNil(o.ReferenceText),
			RefMin:        o.RefMin,
			RefMax:        o.RefMax,
			OutOfRange:    o.OutOfRange,
			Provenance:    o.Provenance,
			Status:        models.ObservationReview,
		})
	}
	return list, skipped
}

// parseCollectedAt accepts the observation date, falling back to the report
// date. A value with no usable date cannot be placed in a series, so it is
// dropped rather than stored against a guessed day.
func parseCollectedAt(value, fallback string) (time.Time, error) {
	for _, candidate := range []string{value, fallback} {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			continue
		}
		if t, err := time.Parse("2006-01-02", candidate); err == nil {
			return t, nil
		}
		if t, err := time.Parse("02/01/2006", candidate); err == nil {
			return t, nil
		}
	}
	return time.Time{}, errors.New("data de coleta ausente ou ilegível")
}

func textOrNil(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// textOrCanonical prefers the unit printed on the report and falls back to the
// catalog unit, which is what the evolutive table usually lacks.
func textOrCanonical(reported string, canonical *string) *string {
	if u := textOrNil(reported); u != nil {
		return u
	}
	return canonical
}

// Get reports the state of one extraction. This is what the frontend polls,
// since the call outlives the 30s fetch timeout.
func (h *ExtractionHandler) Get(w http.ResponseWriter, r *http.Request) {
	extraction, err := models.ExtractionFindByID(r.Context(), h.DB, chi.URLParam(r, "id"))
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, "extração não encontrada", http.StatusNotFound)
		return
	}
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": extraction})
}

// ListByFile returns the extraction history of one document.
func (h *ExtractionHandler) ListByFile(w http.ResponseWriter, r *http.Request) {
	list, err := models.ExtractionFindByFile(r.Context(), h.DB, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

// ListObservations returns what one extraction produced, in review order.
func (h *ExtractionHandler) ListObservations(w http.ResponseWriter, r *http.Request) {
	list, err := models.ObservationFindByExtraction(r.Context(), h.DB, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

// Models lists the curated model options and the one currently selected.
func (h *ExtractionHandler) Models(w http.ResponseWriter, r *http.Request) {
	current, err := models.ConfigGet(r.Context(), h.DB, ConfigKeyGeminiModel, gemini.DefaultModel)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
		"current":   current,
		"available": AvailableModels,
		"apiKeySet": h.Client != nil && h.Client.APIKey != "",
	}})
}

// SetModel stores the chosen model, refusing anything outside the curated list
// so a typo cannot become a failure discovered only at extraction time.
func (h *ExtractionHandler) SetModel(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Model string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, "corpo inválido", http.StatusBadRequest)
		return
	}
	known := false
	for _, m := range AvailableModels {
		if m.Model == in.Model {
			known = true
			break
		}
	}
	if !known {
		writeError(w, "modelo não suportado", http.StatusBadRequest)
		return
	}
	if err := models.ConfigSet(r.Context(), h.DB, ConfigKeyGeminiModel, in.Model); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{"current": in.Model}})
}
