package models

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"io"
	"log/slog"
	"os"
	"time"
)

type File struct {
	ID               string         `json:"id"`
	Filename         string         `json:"filename"`
	CustomName       *string        `json:"customName,omitempty"`
	Path             string         `json:"path"`
	MimeType         string         `json:"mimeType"`
	Size             int64          `json:"size"`
	Hash             *string        `json:"hash,omitempty"`
	ThumbnailPath    *string        `json:"thumbnailPath,omitempty"`
	ConsultationID   *string        `json:"consultationId,omitempty"`
	ConsultationDate *time.Time     `json:"consultationDate,omitempty"`
	ProfessionalID   *string        `json:"professionalId,omitempty"`
	UserID           *string        `json:"userId,omitempty"`
	UserName         *string        `json:"userName,omitempty"`
	ProfessionalName *string        `json:"professionalName,omitempty"`
	Categories       []FileCategory `json:"categories"`
	UploadedAt       time.Time      `json:"uploadedAt"`
}

// fileSelectSQL is the base SELECT with JOINs that populates ProfessionalName and ConsultationDate.
// p1 = direct professional of the file; p2 = professional of the linked consultation.
const fileSelectSQL = `
SELECT f.id, f.filename, f.custom_name, f.path, f.mime_type, f.size,
       f.hash, f.thumbnail_path, f.consultation_id, f.professional_id, f.user_id, f.uploaded_at,
       COALESCE(p1.name, p2.name) AS professional_name,
       c.date AS consultation_date,
       u.name AS user_name
FROM files f
LEFT JOIN consultations c  ON c.id = f.consultation_id
LEFT JOIN professionals p1 ON p1.id = f.professional_id
LEFT JOIN professionals p2 ON p2.id = c.professional_id
LEFT JOIN users u          ON u.id = f.user_id`

func scanFileRow(rows *sql.Rows) (File, error) {
	var f File
	err := rows.Scan(
		&f.ID, &f.Filename, &f.CustomName, &f.Path, &f.MimeType, &f.Size,
		&f.Hash, &f.ThumbnailPath, &f.ConsultationID, &f.ProfessionalID, &f.UserID, &f.UploadedAt,
		&f.ProfessionalName, &f.ConsultationDate,
		&f.UserName,
	)
	return f, err
}

func fileLoadCategoriesBatch(ctx context.Context, db *sql.DB, fileIDs []string) map[string][]FileCategory {
	result := map[string][]FileCategory{}
	if len(fileIDs) == 0 {
		return result
	}
	rows, err := db.QueryContext(ctx,
		`SELECT ffc.file_id, fc.id, fc.name, fc.created_at
		 FROM file_file_categories ffc
		 JOIN file_categories fc ON fc.id = ffc.category_id
		 WHERE ffc.file_id IN `+inClause(len(fileIDs))+`
		 ORDER BY fc.name`,
		anySlice(fileIDs)...)
	if err != nil {
		slog.Error("batch load file categories", "err", err)
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var fileID string
		var c FileCategory
		if err := rows.Scan(&fileID, &c.ID, &c.Name, &c.CreatedAt); err != nil {
			slog.Error("scan file category", "err", err)
			continue
		}
		result[fileID] = append(result[fileID], c)
	}
	return result
}

func attachCategories(ctx context.Context, db *sql.DB, list []File) []File {
	if len(list) == 0 {
		return list
	}
	ids := make([]string, len(list))
	for i, f := range list {
		ids[i] = f.ID
	}
	catMap := fileLoadCategoriesBatch(ctx, db, ids)
	for i, f := range list {
		if cats, ok := catMap[f.ID]; ok {
			list[i].Categories = cats
		}
	}
	return list
}

func FileFindByConsultationID(ctx context.Context, db *sql.DB, consultationID string) ([]File, error) {
	rows, err := db.QueryContext(ctx,
		fileSelectSQL+` WHERE f.consultation_id=? ORDER BY f.uploaded_at DESC`, consultationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []File
	for rows.Next() {
		f, err := scanFileRow(rows)
		if err != nil {
			return nil, err
		}
		f.Categories = []FileCategory{}
		list = append(list, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return attachCategories(ctx, db, list), nil
}

func FileCount(ctx context.Context, db *sql.DB) (int, error) {
	var n int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM files").Scan(&n)
	return n, err
}

func FileFindAll(ctx context.Context, db *sql.DB, limit, offset int) ([]File, error) {
	q := fileSelectSQL + ` ORDER BY f.uploaded_at DESC`
	var args []any
	if limit > 0 {
		q += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []File
	for rows.Next() {
		f, err := scanFileRow(rows)
		if err != nil {
			return nil, err
		}
		f.Categories = []FileCategory{}
		list = append(list, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return attachCategories(ctx, db, list), nil
}

func FileFindByID(ctx context.Context, db *sql.DB, id string) (*File, error) {
	rows, err := db.QueryContext(ctx, fileSelectSQL+` WHERE f.id=?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, sql.ErrNoRows
	}
	f, err := scanFileRow(rows)
	if err != nil {
		return nil, err
	}
	f.Categories = []FileCategory{}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Must close before the nested query below acquires a connection — the
	// pool is pinned to 1 (see internal/db.Open), so a still-open Rows here
	// would starve fileLoadCategoriesBatch of a connection forever (deadlock).
	rows.Close()
	catMap := fileLoadCategoriesBatch(ctx, db, []string{f.ID})
	if cats, ok := catMap[f.ID]; ok {
		f.Categories = cats
	}
	return &f, nil
}

// FileFindByHash looks up an existing file by content hash, scoped to the
// given owner — dedup boundaries follow file ownership, same as everywhere
// else in this codebase (a user only ever sees/attaches their own files;
// admin's "on behalf of" uploads are scoped to the chosen owner).
func FileFindByHash(ctx context.Context, db *sql.DB, hash, ownerUserID string) (*File, error) {
	rows, err := db.QueryContext(ctx, fileSelectSQL+` WHERE f.hash=? AND f.user_id=?`, hash, ownerUserID)
	if err != nil {
		return nil, err
	}
	if !rows.Next() {
		rows.Close()
		return nil, sql.ErrNoRows
	}
	f, err := scanFileRow(rows)
	if err != nil {
		rows.Close()
		return nil, err
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	// See FileFindByID: must close before the nested batch query below.
	rows.Close()
	f.Categories = []FileCategory{}
	catMap := fileLoadCategoriesBatch(ctx, db, []string{f.ID})
	if cats, ok := catMap[f.ID]; ok {
		f.Categories = cats
	}
	return &f, nil
}

// FileListOptions controls filtering and sorting for owner-scoped file queries.
type FileListOptions struct {
	CategoryID     string // empty = no filter
	ProfessionalID string // empty = no filter
	Sort           string // "uploadedAt" | "name" | "professionalName"
	Dir            string // "asc" | "desc"
}

var fileSortCols = map[string]string{
	"uploadedAt":       "COALESCE(c.date, f.uploaded_at)",
	"name":             "COALESCE(f.custom_name, f.filename)",
	"professionalName": "COALESCE(p1.name, p2.name)",
}

func fileOwnerWhere(userID string, opts FileListOptions) (where string, args []any) {
	where = `(f.user_id=? OR c.user_id=?)`
	args = []any{userID, userID}
	if opts.CategoryID != "" {
		where += ` AND f.id IN (SELECT file_id FROM file_file_categories WHERE category_id=?)`
		args = append(args, opts.CategoryID)
	}
	if opts.ProfessionalID != "" {
		where += ` AND (f.professional_id=? OR c.professional_id=?)`
		args = append(args, opts.ProfessionalID, opts.ProfessionalID)
	}
	return where, args
}

func fileOrderBy(opts FileListOptions) string {
	col, ok := fileSortCols[opts.Sort]
	if !ok {
		col = "f.uploaded_at"
	}
	dir := "DESC"
	if opts.Dir == "asc" {
		dir = "ASC"
	}
	return col + " " + dir
}

func FileFindByOwner(ctx context.Context, db *sql.DB, userID string, limit, offset int, opts FileListOptions) ([]File, error) {
	where, args := fileOwnerWhere(userID, opts)
	args = append(args, limit, offset)
	q := fileSelectSQL + ` WHERE ` + where + ` ORDER BY ` + fileOrderBy(opts) + ` LIMIT ? OFFSET ?`
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []File
	for rows.Next() {
		f, err := scanFileRow(rows)
		if err != nil {
			return nil, err
		}
		f.Categories = []FileCategory{}
		list = append(list, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return attachCategories(ctx, db, list), nil
}

func FileCountByOwner(ctx context.Context, db *sql.DB, userID string, opts FileListOptions) (int, error) {
	where, args := fileOwnerWhere(userID, opts)
	var n int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT f.id)
		 FROM files f
		 LEFT JOIN consultations c ON c.id = f.consultation_id
		 WHERE `+where,
		args...).Scan(&n)
	return n, err
}

func fileAllWhere(opts FileListOptions) (where string, args []any) {
	where = "1=1"
	if opts.CategoryID != "" {
		where += ` AND f.id IN (SELECT file_id FROM file_file_categories WHERE category_id=?)`
		args = append(args, opts.CategoryID)
	}
	if opts.ProfessionalID != "" {
		where += ` AND (f.professional_id=? OR c.professional_id=?)`
		args = append(args, opts.ProfessionalID, opts.ProfessionalID)
	}
	return where, args
}

func FileFindAllWithOpts(ctx context.Context, db *sql.DB, limit, offset int, opts FileListOptions) ([]File, error) {
	where, args := fileAllWhere(opts)
	args = append(args, limit, offset)
	q := fileSelectSQL + ` WHERE ` + where + ` ORDER BY ` + fileOrderBy(opts) + ` LIMIT ? OFFSET ?`
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []File
	for rows.Next() {
		f, err := scanFileRow(rows)
		if err != nil {
			return nil, err
		}
		f.Categories = []FileCategory{}
		list = append(list, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return attachCategories(ctx, db, list), nil
}

func FileCountAllWithOpts(ctx context.Context, db *sql.DB, opts FileListOptions) (int, error) {
	where, args := fileAllWhere(opts)
	var n int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT f.id)
		 FROM files f
		 LEFT JOIN consultations c ON c.id = f.consultation_id
		 WHERE `+where,
		args...).Scan(&n)
	return n, err
}

// FileOwnerCheck returns true if the user is the uploader or the consultation owner of the file.
// Returns sql.ErrNoRows if the file does not exist.
func FileOwnerCheck(ctx context.Context, db *sql.DB, fileID, userID string) (bool, error) {
	var uploaderID, consultOwnerID sql.NullString
	err := db.QueryRowContext(ctx,
		`SELECT f.user_id, c.user_id
		 FROM files f
		 LEFT JOIN consultations c ON c.id = f.consultation_id
		 WHERE f.id=?`, fileID).
		Scan(&uploaderID, &consultOwnerID)
	if err != nil {
		return false, err
	}
	return (uploaderID.Valid && uploaderID.String == userID) ||
		(consultOwnerID.Valid && consultOwnerID.String == userID), nil
}

type CreateFileInput struct {
	ID             string
	Filename       string
	CustomName     *string
	Path           string
	MimeType       string
	Size           int64
	Hash           string
	ConsultationID *string
	ProfessionalID *string
	UserID         *string
	CategoryIDs    []string
}

func FileCreate(ctx context.Context, db *sql.DB, in CreateFileInput) (*File, error) {
	now := time.Now().UTC()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx,
		`INSERT INTO files (id, filename, custom_name, path, mime_type, size, hash, consultation_id, professional_id, user_id, uploaded_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		in.ID, in.Filename, in.CustomName, in.Path, in.MimeType, in.Size, in.Hash,
		in.ConsultationID, in.ProfessionalID, in.UserID, now)
	if err != nil {
		return nil, err
	}
	for _, cid := range in.CategoryIDs {
		if _, err := tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO file_file_categories (id, file_id, category_id, created_at) VALUES (?, ?, ?, ?)`,
			newID(), in.ID, cid, now); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return FileFindByID(ctx, db, in.ID)
}

type UpdateFileInput struct {
	CustomName     *string  // nil = set NULL in DB
	ConsultationID *string  // nil = set NULL in DB
	ProfessionalID *string  // nil = set NULL in DB
	CategoryIDs    []string // replaces all existing categories
}

func FileUpdate(ctx context.Context, db *sql.DB, id string, in UpdateFileInput) (*File, error) {
	// Normalize empty string custom_name to nil (store as NULL)
	if in.CustomName != nil && *in.CustomName == "" {
		in.CustomName = nil
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`UPDATE files SET custom_name=?, consultation_id=?, professional_id=? WHERE id=?`,
		in.CustomName, in.ConsultationID, in.ProfessionalID, id); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM file_file_categories WHERE file_id=?`, id); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	for _, cid := range in.CategoryIDs {
		if _, err := tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO file_file_categories (id, file_id, category_id, created_at) VALUES (?, ?, ?, ?)`,
			newID(), id, cid, now); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return FileFindByID(ctx, db, id)
}

// FileDelete removes a file, unless it is linked to a consultation — a file
// must never be destroyed while that link exists, so it is disassociated
// (consultation_id cleared) instead and the record/disk file are kept. The
// bool return reports which of the two happened.
func FileDelete(ctx context.Context, db *sql.DB, id string) (disassociated bool, err error) {
	var consultationID sql.NullString
	if err := db.QueryRowContext(ctx, "SELECT consultation_id FROM files WHERE id=?", id).Scan(&consultationID); err != nil {
		return false, err
	}
	if consultationID.Valid {
		if _, err := db.ExecContext(ctx, "UPDATE files SET consultation_id = NULL WHERE id=?", id); err != nil {
			return false, err
		}
		return true, nil
	}

	var path string
	if err := db.QueryRowContext(ctx, "SELECT path FROM files WHERE id=?", id).Scan(&path); err != nil {
		slog.Error("FileDelete: get path", "id", id, "err", err)
	}
	if _, err := db.ExecContext(ctx, "DELETE FROM files WHERE id=?", id); err != nil {
		return false, err
	}
	if path != "" {
		if err := removeFile(path); err != nil {
			slog.Error("FileDelete: remove file", "path", path, "err", err)
		}
	}
	return false, nil
}

func removeFile(path string) error {
	return os.Remove(path)
}

// FileBackfillHashes computes and stores the content hash for every file
// row that predates hash-based dedup (hash IS NULL) — a one-time,
// idempotent pass safe to run on every startup, so upload-time duplicate
// detection also catches files already on disk before this feature
// existed. A missing/unreadable file is logged and skipped, not fatal.
func FileBackfillHashes(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, "SELECT id, path FROM files WHERE hash IS NULL")
	if err != nil {
		return err
	}
	type pending struct{ id, path string }
	var list []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.path); err != nil {
			rows.Close()
			return err
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	for _, p := range list {
		f, err := os.Open(p.path)
		if err != nil {
			slog.Warn("FileBackfillHashes: skip unreadable file", "id", p.id, "path", p.path, "err", err)
			continue
		}
		h := sha256.New()
		_, copyErr := io.Copy(h, f)
		f.Close()
		if copyErr != nil {
			slog.Warn("FileBackfillHashes: hash read failed", "id", p.id, "err", copyErr)
			continue
		}
		sum := hex.EncodeToString(h.Sum(nil))
		if _, err := db.ExecContext(ctx, "UPDATE files SET hash=? WHERE id=?", sum, p.id); err != nil {
			return err
		}
	}
	return nil
}
