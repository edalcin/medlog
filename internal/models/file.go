package models

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"time"
)

type File struct {
	ID             string         `json:"id"`
	Filename       string         `json:"filename"`
	CustomName     *string        `json:"customName,omitempty"`
	Path           string         `json:"path"`
	MimeType       string         `json:"mimeType"`
	Size           int64          `json:"size"`
	Hash           *string        `json:"hash,omitempty"`
	ThumbnailPath  *string        `json:"thumbnailPath,omitempty"`
	ConsultationID *string        `json:"consultationId,omitempty"`
	ProfessionalID *string        `json:"professionalId,omitempty"`
	UserID         *string        `json:"userId,omitempty"`
	Categories     []FileCategory `json:"categories"`
	UploadedAt     time.Time      `json:"uploadedAt"`
}

// fileLoadCategoriesBatch loads categories for multiple files in a single query.
// Returns a map from file ID to its categories.
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

func FileFindByConsultationID(ctx context.Context, db *sql.DB, consultationID string) ([]File, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, filename, custom_name, path, mime_type, size, hash, thumbnail_path,
		        consultation_id, professional_id, user_id, uploaded_at
		 FROM files WHERE consultation_id=? ORDER BY uploaded_at DESC`, consultationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []File
	var fileIDs []string
	for rows.Next() {
		var f File
		if err := rows.Scan(&f.ID, &f.Filename, &f.CustomName, &f.Path, &f.MimeType, &f.Size,
			&f.Hash, &f.ThumbnailPath, &f.ConsultationID, &f.ProfessionalID, &f.UserID, &f.UploadedAt); err != nil {
			return nil, err
		}
		f.Categories = []FileCategory{}
		list = append(list, f)
		fileIDs = append(fileIDs, f.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(fileIDs) > 0 {
		catMap := fileLoadCategoriesBatch(ctx, db, fileIDs)
		for i, f := range list {
			if cats, ok := catMap[f.ID]; ok {
				list[i].Categories = cats
			}
		}
	}
	return list, nil
}

func FileCount(ctx context.Context, db *sql.DB) (int, error) {
	var n int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM files").Scan(&n)
	return n, err
}

func FileFindAll(ctx context.Context, db *sql.DB, limit, offset int) ([]File, error) {
	q := `SELECT id, filename, custom_name, path, mime_type, size, hash, thumbnail_path,
	             consultation_id, professional_id, user_id, uploaded_at
	      FROM files ORDER BY uploaded_at DESC`
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
		var f File
		if err := rows.Scan(&f.ID, &f.Filename, &f.CustomName, &f.Path, &f.MimeType, &f.Size,
			&f.Hash, &f.ThumbnailPath, &f.ConsultationID, &f.ProfessionalID, &f.UserID, &f.UploadedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, rows.Err()
}

func FileFindByID(ctx context.Context, db *sql.DB, id string) (*File, error) {
	var f File
	err := db.QueryRowContext(ctx,
		`SELECT id, filename, custom_name, path, mime_type, size, hash, thumbnail_path,
		        consultation_id, professional_id, user_id, uploaded_at
		 FROM files WHERE id=?`, id).
		Scan(&f.ID, &f.Filename, &f.CustomName, &f.Path, &f.MimeType, &f.Size,
			&f.Hash, &f.ThumbnailPath, &f.ConsultationID, &f.ProfessionalID, &f.UserID, &f.UploadedAt)
	if err != nil {
		return nil, err
	}
	catMap := fileLoadCategoriesBatch(ctx, db, []string{f.ID})
	if cats, ok := catMap[f.ID]; ok {
		f.Categories = cats
	} else {
		f.Categories = []FileCategory{}
	}
	return &f, nil
}

type CreateFileInput struct {
	ID             string
	Filename       string
	CustomName     *string
	Path           string
	MimeType       string
	Size           int64
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
		`INSERT INTO files (id, filename, custom_name, path, mime_type, size, consultation_id, professional_id, user_id, uploaded_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		in.ID, in.Filename, in.CustomName, in.Path, in.MimeType, in.Size,
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

func FileDelete(ctx context.Context, db *sql.DB, id string) error {
	var path string
	if err := db.QueryRowContext(ctx, "SELECT path FROM files WHERE id=?", id).Scan(&path); err != nil {
		slog.Error("FileDelete: get path", "id", id, "err", err)
	}
	if _, err := db.ExecContext(ctx, "DELETE FROM files WHERE id=?", id); err != nil {
		return err
	}
	if path != "" {
		if err := removeFile(path); err != nil {
			slog.Error("FileDelete: remove file", "path", path, "err", err)
		}
	}
	return nil
}

func removeFile(path string) error {
	return os.Remove(path)
}
