package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strconv"
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

// caller answers who is asking and whether they are an administrator.
func caller(r *http.Request) (userID string, admin bool) {
	userID = auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	return userID, auth.Manager.GetString(r.Context(), auth.SessionKeyRole) == "ADMIN"
}

// mayReachExtraction gates every extraction-scoped route. A USER reaches the
// extractions of their own documents; an ADMIN reaches all of them, which is
// what the admin panel and family support need.
//
// The answer is 404, never 403: the existence of somebody else's extraction is
// itself information this caller has no business receiving.
func (h *ExtractionHandler) mayReachExtraction(w http.ResponseWriter, r *http.Request, id string) (*models.Extraction, bool) {
	extraction, err := models.ExtractionFindByID(r.Context(), h.DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, "extração não encontrada", http.StatusNotFound)
		return nil, false
	}
	if err != nil {
		writeDBError(w, err)
		return nil, false
	}
	if userID, admin := caller(r); !admin && extraction.UserID != userID {
		writeError(w, "extração não encontrada", http.StatusNotFound)
		return nil, false
	}
	return extraction, true
}

// mayReachFile is the same gate for the document-scoped routes.
func (h *ExtractionHandler) mayReachFile(w http.ResponseWriter, r *http.Request, id string) (*models.File, bool) {
	file, err := models.FileFindByID(r.Context(), h.DB, id)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && file == nil) {
		writeError(w, "documento não encontrado", http.StatusNotFound)
		return nil, false
	}
	if err != nil {
		writeDBError(w, err)
		return nil, false
	}
	userID, admin := caller(r)
	if !admin && (file.UserID == nil || *file.UserID != userID) {
		writeError(w, "documento não encontrado", http.StatusNotFound)
		return nil, false
	}
	return file, true
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
	// A USER extracts the documents that are theirs; an ADMIN extracts anyone's.
	// The document owner, not the caller, owns the resulting Observations.
	triggeredBy, admin := caller(r)
	if !admin && *file.UserID != triggeredBy {
		writeError(w, "documento não encontrado", http.StatusNotFound)
		return
	}

	model, err := models.ConfigGet(r.Context(), h.DB, ConfigKeyGeminiModel, gemini.DefaultModel)
	if err != nil {
		writeDBError(w, err)
		return
	}

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

	pdf, err := os.ReadFile(resolveFilePath(h.FilesPath, path))
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

	// A new extraction supersedes the previous attempt on the same document:
	// whatever the earlier run left in review is stale, and would otherwise
	// keep the document flagged as pending forever.
	superseded, err := models.ObservationDiscardSupersededReview(ctx, h.DB, e.FileID, e.ID)
	if err != nil {
		log.Error("discard superseded observations", "err", err)
	}
	// And the older extraction rows go with it: one document, one extraction.
	dropped, err := models.ExtractionDeleteSuperseded(ctx, h.DB, e.FileID, e.ID)
	if err != nil {
		log.Error("delete superseded extractions", "err", err)
	}
	log.Info("extraction done",
		"observations", len(observations), "skipped", skipped,
		"supersededObservations", superseded, "supersededExtractions", dropped,
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
		// The lab glues its alteration marker to the number: "9.000(1)". The
		// marker carries meaning but is not part of the value, so the number is
		// read without it, and the marker answers out_of_range when the model
		// left it null.
		marked := markerRE.MatchString(strings.TrimSpace(o.ValueText))
		valueNum := o.ValueNum
		if valueNum == nil {
			valueNum = deriveValue(o.ValueText)
		}
		outOfRange := o.OutOfRange
		if outOfRange == nil && marked {
			t := true
			outOfRange = &t
		}
		// The model still drops bounds now and then, even with the field
		// required. When it does, read them off the literal it did send.
		refMin, refMax := o.RefMin, o.RefMax
		if refMin == nil && refMax == nil {
			refMin, refMax = deriveRange(o.ReferenceText)
		}
		list = append(list, models.Observation{
			UserID:        e.UserID,
			IndicatorID:   indicator.ID,
			SourceFileID:  &fileID,
			ExtractionID:  &extractionID,
			CollectedAt:   collectedAt,
			ValueText:     o.ValueText,
			ValueNum:      valueNum,
			Unit:          textOrCanonical(o.Unit, indicator.Unit),
			ReferenceText: textOrNil(o.ReferenceText),
			RefMin:        refMin,
			RefMax:        refMax,
			OutOfRange:    outOfRange,
			Provenance:    o.Provenance,
			Status:        models.ObservationReview,
		})
	}
	return list, skipped
}

// markerRE matches the alteration marker the lab prints glued to an altered
// result: "9.000(1)". It carries meaning, but it is not part of the number.
var markerRE = regexp.MustCompile(`\(\d\)\s*$`)

// numberRE matches one number printed the Brazilian way: "9.000", "5,40",
// "1.234,56", "93". Nothing else — a value with a qualifier is not a number.
var numberRE = regexp.MustCompile(`^\d{1,3}(?:\.\d{3})+(?:,\d+)?$|^\d+(?:,\d+)?$`)

// rangeRE matches a single printed interval: "4,32 a 5,67", "3.650 a 8.120",
// "13,3 - 16,5". The separator must stand alone, so "5,67 milhões" never reads
// as a bound.
var rangeRE = regexp.MustCompile(`(\d+(?:[.,]\d+)*)\s*(?:\s[aA]\s|-|–|\s[aA]té\s)\s*(\d+(?:[.,]\d+)*)`)

// conditionalRE marks a reference the report qualifies by patient or context.
// ADR 0004 keeps those as text only: one printed interval is a fact, a
// conditional table is a decision the MedLog does not make.
var conditionalRE = regexp.MustCompile(`(?i)(masc|fem|homem|mulher|anos|idade|jejum|etnia|afro|risco|depende|gestante|crian|adulto|categoria|conforme)`)

// parseNumberBR reads a number the way a Brazilian lab prints it: the dot
// groups thousands and the comma opens the decimals. "3.650" is three thousand
// six hundred and fifty, never 3.65 — reading it backwards moved a leukocyte
// reference range by a factor of a thousand.
func parseNumberBR(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	if !numberRE.MatchString(s) {
		return 0, false
	}
	s = strings.ReplaceAll(s, ".", "")
	s = strings.Replace(s, ",", ".", 1)
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// deriveValue recovers the number from a result the model left unquantified.
// It accepts a bare printed number with the lab marker stripped, and nothing
// else: ">90" and "normais" stay without a number, because they are not points
// on an axis.
func deriveValue(text string) *float64 {
	text = markerRE.ReplaceAllString(strings.TrimSpace(text), "")
	v, ok := parseNumberBR(text)
	if !ok {
		return nil
	}
	return &v
}

// deriveRange reads numeric bounds out of the reference text exactly as
// printed. This is transcription, not calculation: anything conditional, open
// ended or carrying more than one interval yields no bounds at all.
func deriveRange(text string) (*float64, *float64) {
	text = strings.TrimSpace(text)
	if text == "" || conditionalRE.MatchString(text) {
		return nil, nil
	}
	matches := rangeRE.FindAllStringSubmatch(text, 2)
	if len(matches) != 1 {
		return nil, nil
	}
	lo, okLo := parseNumberBR(matches[0][1])
	hi, okHi := parseNumberBR(matches[0][2])
	if !okLo || !okHi || lo >= hi {
		return nil, nil
	}
	return &lo, &hi
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

// reviewPayload is everything the review screen needs in one round trip: the
// observations, the analytes the catalog could not place, and the document
// metadata as suggestion versus current value.
type reviewPayload struct {
	Extraction   *models.Extraction   `json:"extraction"`
	File         *models.File         `json:"file"`
	Observations []models.Observation `json:"observations"`
	Unmapped     []gemini.Unmapped    `json:"unmapped"`
	Metadata     []metadataField      `json:"metadata"`
}

// metadataField carries a suggestion beside what the document already holds.
// Divergent means a human already typed something different: the review shows
// it, and confirmation keeps the human value.
type metadataField struct {
	Field     string `json:"field"`
	Label     string `json:"label"`
	Suggested string `json:"suggested"`
	Current   string `json:"current"`
	Divergent bool   `json:"divergent"`
	WillBeSet bool   `json:"willBeSet"`
}

// Review returns the whole block to be confirmed or rejected at once.
func (h *ExtractionHandler) Review(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	extraction, ok := h.mayReachExtraction(w, r, id)
	if !ok {
		return
	}

	file, err := models.FileFindByID(r.Context(), h.DB, extraction.FileID)
	if err != nil {
		writeDBError(w, err)
		return
	}

	observations, err := models.ObservationFindByExtraction(r.Context(), h.DB, id)
	if err != nil {
		writeDBError(w, err)
		return
	}

	// Unmapped analytes and metadata suggestions are re-derived from the
	// stored raw response, so nothing extra needs a column of its own.
	payload := reviewPayload{Extraction: extraction, File: file, Observations: observations, Unmapped: []gemini.Unmapped{}}
	if raw, err := models.ExtractionRawResponse(r.Context(), h.DB, id); err == nil && raw != "" {
		if result, _, err := gemini.ParseRaw(raw); err == nil {
			payload.Unmapped = result.Unmapped
			payload.Metadata = metadataFields(file, result)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": payload})
}

func metadataFields(file *models.File, res *gemini.Result) []metadataField {
	suggestedName := ""
	if res.CollectedAt != "" {
		if t, err := time.Parse("2006-01-02", res.CollectedAt); err == nil {
			suggestedName = "Exame de sangue — " + t.Format("02/01/2006")
		}
	}

	current := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	currentCollected := ""
	if file.CollectedAt != nil {
		currentCollected = file.CollectedAt.Format("2006-01-02")
	}

	fields := []metadataField{
		{Field: "collectedAt", Label: "Data de coleta", Suggested: res.CollectedAt, Current: currentCollected},
		{Field: "labName", Label: "Laboratório", Suggested: res.LabName, Current: current(file.LabName)},
		{Field: "reportNumber", Label: "Número da ficha", Suggested: res.ReportNumber, Current: current(file.ReportNumber)},
		{Field: "customName", Label: "Nome do documento", Suggested: suggestedName, Current: current(file.CustomName)},
	}
	for i := range fields {
		f := &fields[i]
		f.Divergent = f.Current != "" && f.Suggested != "" && f.Current != f.Suggested
		f.WillBeSet = f.Current == "" && f.Suggested != ""
	}
	return fields
}

// Confirm promotes the whole block at once and writes the document metadata
// that was still empty. Block confirmation is one act, not forty (ADR 0009).
func (h *ExtractionHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	extraction, ok := h.mayReachExtraction(w, r, id)
	if !ok {
		return
	}

	confirmed, err := models.ObservationConfirmByExtraction(r.Context(), h.DB, id)
	if err != nil {
		writeDBError(w, err)
		return
	}

	applied := []string{}
	if raw, err := models.ExtractionRawResponse(r.Context(), h.DB, id); err == nil && raw != "" {
		if result, _, err := gemini.ParseRaw(raw); err == nil {
			meta := models.ExtractedMetadata{LabName: result.LabName, ReportNumber: result.ReportNumber}
			if t, err := time.Parse("2006-01-02", result.CollectedAt); err == nil {
				meta.CollectedAt = &t
				meta.CustomName = "Exame de sangue — " + t.Format("02/01/2006")
			}
			applied, err = models.FileApplyExtractedMetadata(r.Context(), h.DB, extraction.FileID, meta)
			if err != nil {
				writeDBError(w, err)
				return
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
		"confirmed":       confirmed,
		"metadataApplied": applied,
	}})
}

// Reject discards the observations and keeps the Extraction: the raw response
// stays auditable and reinterpretable (ADR 0009).
func (h *ExtractionHandler) Reject(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.mayReachExtraction(w, r, chi.URLParam(r, "id")); !ok {
		return
	}
	rejected, err := models.ObservationRejectByExtraction(r.Context(), h.DB, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{"rejected": rejected}})
}

// PromoteIndicator adds a code the catalog lacked, from a pending analyte.
// Creating an Indicator is always an explicit ADMIN act, never a side effect.
func (h *ExtractionHandler) PromoteIndicator(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code string `json:"code"`
		Name string `json:"name"`
		Unit string `json:"unit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, "corpo inválido", http.StatusBadRequest)
		return
	}
	in.Code, in.Name = strings.TrimSpace(in.Code), strings.TrimSpace(in.Name)
	if in.Code == "" || in.Name == "" {
		writeError(w, "code e name são obrigatórios", http.StatusBadRequest)
		return
	}
	indicator, err := models.IndicatorCreate(r.Context(), h.DB, in.Code, in.Name, textOrNil(in.Unit))
	if err != nil {
		writeError(w, "não foi possível criar o indicador: "+err.Error(), http.StatusConflict)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": indicator})
}

// ListIndicators exposes the catalog, which the review screen needs to offer
// a code when promoting a pending analyte.
func (h *ExtractionHandler) ListIndicators(w http.ResponseWriter, r *http.Request) {
	list, err := models.IndicatorFindAll(r.Context(), h.DB)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

// Get reports the state of one extraction. This is what the frontend polls,
// since the call outlives the 30s fetch timeout.
func (h *ExtractionHandler) Get(w http.ResponseWriter, r *http.Request) {
	extraction, ok := h.mayReachExtraction(w, r, chi.URLParam(r, "id"))
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": extraction})
}

// ListByFile returns the extraction history of one document.
func (h *ExtractionHandler) ListByFile(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.mayReachFile(w, r, chi.URLParam(r, "id")); !ok {
		return
	}
	list, err := models.ExtractionFindByFile(r.Context(), h.DB, chi.URLParam(r, "id"))
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

// ResetFile erases the extraction history of a document and every observation
// that came from it, confirmed included. It exists for the deliberate restart:
// trying another model from a clean slate, without the previous answer's
// values lingering in the series.
func (h *ExtractionHandler) ResetFile(w http.ResponseWriter, r *http.Request) {
	fileID := chi.URLParam(r, "id")
	if _, ok := h.mayReachFile(w, r, fileID); !ok {
		return
	}
	observations, extractions, err := models.ExtractionResetFile(r.Context(), h.DB, fileID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	slog.Info("extraction reset", "file", fileID,
		"observations", observations, "extractions", extractions,
		"by", auth.Manager.GetString(r.Context(), auth.SessionKeyUserID))
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]int64{
		"observations": observations,
		"extractions":  extractions,
	}})
}

// ListObservations returns what one extraction produced, in review order.
func (h *ExtractionHandler) ListObservations(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.mayReachExtraction(w, r, chi.URLParam(r, "id")); !ok {
		return
	}
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
