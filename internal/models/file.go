package models

import (
	"context"
	"database/sql"
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

func fileLoadCategories(ctx context.Context, db *sql.DB, fileID string) ([]FileCategory, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT fc.id, fc.name, fc.created_at
		 FROM file_categories fc
		 JOIN file_file_categories ffc ON ffc.category_id = fc.id
		 WHERE ffc.file_id = ?
		 ORDER BY fc.name`, fileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []FileCategory{}
	for rows.Next() {
		var c FileCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
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
	for rows.Next() {
		var f File
		if err := rows.Scan(&f.ID, &f.Filename, &f.CustomName, &f.Path, &f.MimeType, &f.Size,
			&f.Hash, &f.ThumbnailPath, &f.ConsultationID, &f.ProfessionalID, &f.UserID, &f.UploadedAt); err != nil {
			return nil, err
		}
		f.Categories, _ = fileLoadCategories(ctx, db, f.ID)
		list = append(list, f)
	}
	return list, rows.Err()
}

func FileFindAll(ctx context.Context, db *sql.DB) ([]File, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, filename, custom_name, path, mime_type, size, hash, thumbnail_path,
		        consultation_id, professional_id, user_id, uploaded_at
		 FROM files ORDER BY uploaded_at DESC`)
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
	f.Categories, _ = fileLoadCategories(ctx, db, f.ID)
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
		_, _ = tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO file_file_categories (id, file_id, category_id, created_at) VALUES (?, ?, ?, ?)`,
			newID(), in.ID, cid, now)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return FileFindByID(ctx, db, in.ID)
}

func FileDelete(ctx context.Context, db *sql.DB, id string) error {
	var path string
	_ = db.QueryRowContext(ctx, "SELECT path FROM files WHERE id=?", id).Scan(&path)
	_, err := db.ExecContext(ctx, "DELETE FROM files WHERE id=?", id)
	if err != nil {
		return err
	}
	if path != "" {
		_ = removeFile(path)
	}
	return nil
}

func removeFile(path string) error {
	return os.Remove(path)
}
