package models

import (
	"context"
	"database/sql"
	"time"
)

type FileCategory struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

func CategoryFindAll(ctx context.Context, db *sql.DB) ([]FileCategory, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, name, created_at FROM file_categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []FileCategory
	for rows.Next() {
		var c FileCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func CategoryFindByID(ctx context.Context, db *sql.DB, id string) (*FileCategory, error) {
	var c FileCategory
	err := db.QueryRowContext(ctx, `SELECT id, name, created_at FROM file_categories WHERE id=?`, id).
		Scan(&c.ID, &c.Name, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func CategoryCreate(ctx context.Context, db *sql.DB, id, name string) (*FileCategory, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx, `INSERT INTO file_categories (id, name, created_at) VALUES (?, ?, ?)`, id, name, now)
	if err != nil {
		return nil, err
	}
	return CategoryFindByID(ctx, db, id)
}

func CategoryUpdate(ctx context.Context, db *sql.DB, id, name string) (*FileCategory, error) {
	_, err := db.ExecContext(ctx, `UPDATE file_categories SET name=? WHERE id=?`, name, id)
	if err != nil {
		return nil, err
	}
	return CategoryFindByID(ctx, db, id)
}

func CategoryDelete(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM file_categories WHERE id=?`, id)
	return err
}

func CategoryIsInUse(ctx context.Context, db *sql.DB, id string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM file_file_categories WHERE category_id=?`, id).Scan(&count)
	return count > 0, err
}
