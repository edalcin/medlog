package models

import (
	"context"
	"database/sql"
	"time"
)

// Indicator is a catalog entry: the definition of something measurable.
// The catalog is global (no user_id) and grows only by ADMIN decision.
type Indicator struct {
	ID   string  `json:"id"`
	Code string  `json:"code"`
	Name string  `json:"name"`
	Unit *string `json:"unit,omitempty"`
}

// Observation is one measurement of an Indicator. ValueText is always the
// literal printed on the report; ValueNum is set only when the result is a
// number without qualifier, so ">90" never becomes 90.
type Observation struct {
	ID            string  `json:"id"`
	UserID        string  `json:"userId"`
	IndicatorID   string  `json:"indicatorId"`
	IndicatorCode string  `json:"indicatorCode,omitempty"`
	IndicatorName string  `json:"indicatorName,omitempty"`
	SourceFileID  *string `json:"sourceFileId,omitempty"`
	// Nome do arquivo do Laudo de origem, lido por JOIN: a rota de download é
	// GET /api/files/{filename}, e o ID sozinho não monta a URL.
	SourceFilename *string   `json:"sourceFilename,omitempty"`
	ExtractionID   *string   `json:"extractionId,omitempty"`
	CollectedAt    time.Time `json:"collectedAt"`
	ValueText      string    `json:"valueText"`
	ValueNum       *float64  `json:"valueNum,omitempty"`
	Unit           *string   `json:"unit,omitempty"`
	ReferenceText  *string   `json:"referenceText,omitempty"`
	RefMin         *float64  `json:"refMin,omitempty"`
	RefMax         *float64  `json:"refMax,omitempty"`
	OutOfRange     *bool     `json:"outOfRange,omitempty"`
	Provenance     string    `json:"provenance"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"createdAt"`
}

// Extraction is the record of one send to the AI provider. It is created
// before the call, so a crash mid-flight leaves evidence instead of silence.
type Extraction struct {
	ID            string     `json:"id"`
	UserID        string     `json:"userId"`
	FileID        string     `json:"fileId"`
	TriggeredBy   *string    `json:"triggeredBy,omitempty"`
	Model         string     `json:"model"`
	PromptVersion string     `json:"promptVersion"`
	SchemaVersion string     `json:"schemaVersion"`
	Status        string     `json:"status"`
	InputTokens   *int       `json:"inputTokens,omitempty"`
	OutputTokens  *int       `json:"outputTokens,omitempty"`
	Error         *string    `json:"error,omitempty"`
	ConsentedAt   time.Time  `json:"consentedAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	FinishedAt    *time.Time `json:"finishedAt,omitempty"`
	// Counted, never serialized: the review screen needs the size, not the rows.
	ObservationCount int `json:"observationCount"`
}

// Extraction statuses (schema-enforced by CHECK).
const (
	ExtractionPending   = "pending"
	ExtractionSucceeded = "succeeded"
	ExtractionFailed    = "failed"
)

// Observation status and provenance (schema-enforced by CHECK).
const (
	ObservationReview    = "review"
	ObservationConfirmed = "confirmed"
	ProvenancePrimary    = "primary"
	ProvenanceEvolutive  = "evolutive"
)

// IndicatorFindAll returns the whole catalog, ordered by code so the prompt
// sent to the model is byte-stable across calls.
func IndicatorFindAll(ctx context.Context, db *sql.DB) ([]Indicator, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, code, name, unit FROM health_indicators ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []Indicator{}
	for rows.Next() {
		var i Indicator
		if err := rows.Scan(&i.ID, &i.Code, &i.Name, &i.Unit); err != nil {
			return nil, err
		}
		list = append(list, i)
	}
	return list, rows.Err()
}

// IndicatorCreate adds a code the catalog did not have. Promoting a pending
// analyte is an ADMIN action, never an automatic side effect of extraction.
func IndicatorCreate(ctx context.Context, db *sql.DB, code, name string, unit *string) (*Indicator, error) {
	i := Indicator{ID: newID(), Code: code, Name: name, Unit: unit}
	_, err := db.ExecContext(ctx,
		`INSERT INTO health_indicators (id, code, name, unit, created_at) VALUES (?, ?, ?, ?, ?)`,
		i.ID, i.Code, i.Name, i.Unit, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// ExtractionCreate persists the record before the network call happens, with
// the consent timestamp that authorized this specific send.
func ExtractionCreate(ctx context.Context, db *sql.DB, userID, fileID, triggeredBy, model, promptVersion, schemaVersion string, consentedAt time.Time) (*Extraction, error) {
	e := Extraction{
		ID:            newID(),
		UserID:        userID,
		FileID:        fileID,
		TriggeredBy:   &triggeredBy,
		Model:         model,
		PromptVersion: promptVersion,
		SchemaVersion: schemaVersion,
		Status:        ExtractionPending,
		ConsentedAt:   consentedAt,
		CreatedAt:     time.Now().UTC(),
	}
	_, err := db.ExecContext(ctx,
		`INSERT INTO extractions (id, user_id, file_id, triggered_by, model, prompt_version, schema_version, status, consented_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID, e.UserID, e.FileID, e.TriggeredBy, e.Model, e.PromptVersion, e.SchemaVersion, e.Status, e.ConsentedAt, e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// ExtractionFail records a failure. The raw response is kept when there is
// one, because a malformed answer is still evidence of what was paid for.
func ExtractionFail(ctx context.Context, db *sql.DB, id, reason, rawResponse string, inputTokens, outputTokens *int) error {
	_, err := db.ExecContext(ctx,
		`UPDATE extractions SET status=?, error=?, raw_response=?, input_tokens=?, output_tokens=?, finished_at=? WHERE id=?`,
		ExtractionFailed, reason, nullString(rawResponse), inputTokens, outputTokens, time.Now().UTC(), id)
	return err
}

// ExtractionSucceed stores the raw response and the token cost. It runs
// before interpretation, so a parsing bug never costs a second call.
func ExtractionSucceed(ctx context.Context, db *sql.DB, id, rawResponse string, inputTokens, outputTokens int) error {
	_, err := db.ExecContext(ctx,
		`UPDATE extractions SET status=?, raw_response=?, input_tokens=?, output_tokens=?, finished_at=? WHERE id=?`,
		ExtractionSucceeded, rawResponse, inputTokens, outputTokens, time.Now().UTC(), id)
	return err
}

const extractionSelectSQL = `
SELECT e.id, e.user_id, e.file_id, e.triggered_by, e.model, e.prompt_version, e.schema_version,
       e.status, e.input_tokens, e.output_tokens, e.error, e.consented_at, e.created_at, e.finished_at,
       (SELECT COUNT(*) FROM health_observations o WHERE o.extraction_id = e.id)
FROM extractions e`

func scanExtraction(row interface{ Scan(...any) error }) (Extraction, error) {
	var e Extraction
	err := row.Scan(&e.ID, &e.UserID, &e.FileID, &e.TriggeredBy, &e.Model, &e.PromptVersion, &e.SchemaVersion,
		&e.Status, &e.InputTokens, &e.OutputTokens, &e.Error, &e.ConsentedAt, &e.CreatedAt, &e.FinishedAt,
		&e.ObservationCount)
	return e, err
}

// ExtractionFindByID returns the record without the raw response: it is large
// and only the reprocessing path needs it.
func ExtractionFindByID(ctx context.Context, db *sql.DB, id string) (*Extraction, error) {
	e, err := scanExtraction(db.QueryRowContext(ctx, extractionSelectSQL+` WHERE e.id = ?`, id))
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// ExtractionRawResponse returns the stored provider answer verbatim.
func ExtractionRawResponse(ctx context.Context, db *sql.DB, id string) (string, error) {
	var raw sql.NullString
	err := db.QueryRowContext(ctx, `SELECT raw_response FROM extractions WHERE id = ?`, id).Scan(&raw)
	return raw.String, err
}

// ExtractionFindByFile lists the extraction history of one document, newest first.
func ExtractionFindByFile(ctx context.Context, db *sql.DB, fileID string) ([]Extraction, error) {
	rows, err := db.QueryContext(ctx, extractionSelectSQL+` WHERE e.file_id = ? ORDER BY e.created_at DESC`, fileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []Extraction{}
	for rows.Next() {
		e, err := scanExtraction(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

// ExtractionMarkStale fails every extraction still pending. A goroutine cannot
// survive a restart, so a pending row found at startup is a lost call, not
// progress — showing it as running forever would be a lie.
func ExtractionMarkStale(ctx context.Context, db *sql.DB) (int64, error) {
	res, err := db.ExecContext(ctx,
		`UPDATE extractions SET status=?, error=?, finished_at=? WHERE status=?`,
		ExtractionFailed, "interrompida por reinício do servidor", time.Now().UTC(), ExtractionPending)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ObservationInsertBatch writes the interpreted observations in one
// transaction. Observations are born in review: nothing here is visible to a
// chart until an ADMIN confirms the block.
//
// The unique index on (user_id, indicator_id, collected_at, provenance) makes
// re-extracting the same collection idempotent per provenance, and lets a
// primary value replace an evolutive one for the same date.
func ObservationInsertBatch(ctx context.Context, db *sql.DB, list []Observation) error {
	if len(list) == 0 {
		return nil
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO health_observations
		 (id, user_id, indicator_id, source_file_id, extraction_id, collected_at, value_text, value_num,
		  unit, reference_text, ref_min, ref_max, out_of_range, provenance, status, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (user_id, indicator_id, collected_at, provenance) DO UPDATE SET
		     value_text     = excluded.value_text,
		     value_num      = excluded.value_num,
		     unit           = excluded.unit,
		     reference_text = excluded.reference_text,
		     ref_min        = excluded.ref_min,
		     ref_max        = excluded.ref_max,
		     out_of_range   = excluded.out_of_range,
		     source_file_id = excluded.source_file_id,
		     extraction_id  = excluded.extraction_id,
		     status         = excluded.status`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for _, o := range list {
		if _, err := stmt.ExecContext(ctx, newID(), o.UserID, o.IndicatorID, o.SourceFileID, o.ExtractionID,
			o.CollectedAt, o.ValueText, o.ValueNum, o.Unit, o.ReferenceText, o.RefMin, o.RefMax,
			o.OutOfRange, o.Provenance, o.Status, now); err != nil {
			return err
		}
	}
	return tx.Commit()
}

const observationSelectSQL = `
SELECT o.id, o.user_id, o.indicator_id, i.code, i.name, o.source_file_id, f.filename, o.extraction_id,
       o.collected_at, o.value_text, o.value_num, o.unit, o.reference_text, o.ref_min, o.ref_max,
       o.out_of_range, o.provenance, o.status, o.created_at
FROM health_observations o
JOIN health_indicators i ON i.id = o.indicator_id
LEFT JOIN files f ON f.id = o.source_file_id`

func scanObservations(rows *sql.Rows) ([]Observation, error) {
	list := []Observation{}
	for rows.Next() {
		var o Observation
		if err := rows.Scan(&o.ID, &o.UserID, &o.IndicatorID, &o.IndicatorCode, &o.IndicatorName,
			&o.SourceFileID, &o.SourceFilename, &o.ExtractionID, &o.CollectedAt, &o.ValueText,
			&o.ValueNum, &o.Unit, &o.ReferenceText, &o.RefMin, &o.RefMax, &o.OutOfRange,
			&o.Provenance, &o.Status, &o.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, rows.Err()
}

// ObservationFindByExtraction returns what one extraction produced, in the
// order the review screen reads it: by collection date, then by indicator.
func ObservationFindByExtraction(ctx context.Context, db *sql.DB, extractionID string) ([]Observation, error) {
	rows, err := db.QueryContext(ctx, observationSelectSQL+
		` WHERE o.extraction_id = ? ORDER BY o.collected_at DESC, i.code`, extractionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanObservations(rows)
}

// ObservationFindSeries returns the confirmed time series of one indicator,
// one Observation per collected_at. Quando a mesma Data de coleta tem uma
// linha "primary" e uma "evolutive" (o índice único as mantém as duas —
// nada é apagado), a "primary" prevalece na leitura; a "evolutive" só
// aparece quando não existe "primary" irmã naquela data (ADR 0013).
// collected_at é comparado como texto cru, nunca formatado, porque é assim
// que o índice de deduplicação o entende.
func ObservationFindSeries(ctx context.Context, db *sql.DB, userID, indicatorCode string) ([]Observation, error) {
	rows, err := db.QueryContext(ctx, observationSelectSQL+
		` WHERE o.user_id = ? AND i.code = ? AND o.status = ?
		    AND NOT (o.provenance = 'evolutive' AND EXISTS (
		        SELECT 1 FROM health_observations p
		        WHERE p.user_id = o.user_id AND p.indicator_id = o.indicator_id
		          AND p.collected_at = o.collected_at AND p.provenance = 'primary'
		    ))
		  ORDER BY o.collected_at`,
		userID, indicatorCode, ObservationConfirmed)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanObservations(rows)
}

// IndicatorSeries is one row of the series index: an Indicator the user has
// confirmed data for. NumericCount is what a chart can draw; the difference
// against Count is the part that only exists as a list, because ">90" has no
// place on an axis.
type IndicatorSeries struct {
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	Unit            *string `json:"unit,omitempty"`
	Count           int     `json:"count"`
	NumericCount    int     `json:"numericCount"`
	LastCollectedAt string  `json:"lastCollectedAt"`
}

// IndicatorSeriesIndex lists the Indicators that have confirmed Observations
// for one user. Anything still in review is absent on purpose (ADR 0009).
func IndicatorSeriesIndex(ctx context.Context, db *sql.DB, userID string) ([]IndicatorSeries, error) {
	rows, err := db.QueryContext(ctx, `
SELECT i.code, i.name, i.unit, COUNT(*),
       SUM(CASE WHEN o.value_num IS NOT NULL THEN 1 ELSE 0 END),
       MAX(o.collected_at)
FROM health_observations o
JOIN health_indicators i ON i.id = o.indicator_id
WHERE o.user_id = ? AND o.status = ?
GROUP BY i.id
ORDER BY i.name`, userID, ObservationConfirmed)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []IndicatorSeries{}
	for rows.Next() {
		var s IndicatorSeries
		var last string
		if err := rows.Scan(&s.Code, &s.Name, &s.Unit, &s.Count, &s.NumericCount, &last); err != nil {
			return nil, err
		}
		// Stored as "YYYY-MM-DD HH:MM:SS+00:00"; the index only shows the day.
		if len(last) >= 10 {
			last = last[:10]
		}
		s.LastCollectedAt = last
		list = append(list, s)
	}
	return list, rows.Err()
}

// ObservationDiscardSupersededReview drops observations still in review that
// belong to older extractions of the same document. A new extraction of a
// document supersedes the previous attempt: what the new run did not produce
// is not pending work, it is leftover from an answer nobody accepted.
//
// Rows already confirmed are never touched, and the old Extraction survives
// with its raw response, so the audit trail stays intact (ADR 0009).
func ObservationDiscardSupersededReview(ctx context.Context, db *sql.DB, fileID, keepExtractionID string) (int64, error) {
	res, err := db.ExecContext(ctx,
		`DELETE FROM health_observations
		 WHERE source_file_id = ? AND status = ?
		   AND (extraction_id IS NULL OR extraction_id <> ?)`,
		fileID, ObservationReview, keepExtractionID)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ExtractionDeleteSuperseded removes the older extractions of a document once
// a new one has landed. One document keeps one extraction: the history of
// discarded attempts is noise, not audit.
//
// Observations already confirmed survive: extraction_id is ON DELETE SET NULL,
// and source_file_id still says which document they came from. A pending row
// is never touched, since a call may be in flight.
func ExtractionDeleteSuperseded(ctx context.Context, db *sql.DB, fileID, keepID string) (int64, error) {
	res, err := db.ExecContext(ctx,
		`DELETE FROM extractions WHERE file_id = ? AND id <> ? AND status <> ?`,
		fileID, keepID, ExtractionPending)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ExtractionResetFile wipes the extraction history of one document and every
// observation that came from it, confirmed included. This is the deliberate
// "start over" — trying another model on a clean slate — so it is destructive
// on purpose and never runs as a side effect.
func ExtractionResetFile(ctx context.Context, db *sql.DB, fileID string) (observations, extractions int64, err error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	obsRes, err := tx.ExecContext(ctx, `DELETE FROM health_observations WHERE source_file_id = ?`, fileID)
	if err != nil {
		return 0, 0, err
	}
	extRes, err := tx.ExecContext(ctx, `DELETE FROM extractions WHERE file_id = ?`, fileID)
	if err != nil {
		return 0, 0, err
	}
	observations, _ = obsRes.RowsAffected()
	extractions, _ = extRes.RowsAffected()
	return observations, extractions, tx.Commit()
}

// ObservationConfirmByExtraction promotes a whole extraction at once: block
// confirmation is one act, not forty.
func ObservationConfirmByExtraction(ctx context.Context, db *sql.DB, extractionID string) (int64, error) {
	res, err := db.ExecContext(ctx,
		`UPDATE health_observations SET status=? WHERE extraction_id=? AND status=?`,
		ObservationConfirmed, extractionID, ObservationReview)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// ObservationRejectByExtraction discards the observations and keeps the
// extraction: the raw response stays auditable and reinterpretable.
func ObservationRejectByExtraction(ctx context.Context, db *sql.DB, extractionID string) (int64, error) {
	res, err := db.ExecContext(ctx,
		`DELETE FROM health_observations WHERE extraction_id=? AND status=?`,
		extractionID, ObservationReview)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
