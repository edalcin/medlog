package models

import (
	"context"
	"database/sql"
	"time"
)

type Specialty struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

func SpecialtyFindAll(ctx context.Context, db *sql.DB) ([]Specialty, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, name, created_at FROM specialties ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Specialty
	for rows.Next() {
		var s Specialty
		if err := rows.Scan(&s.ID, &s.Name, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func SpecialtyFindByID(ctx context.Context, db *sql.DB, id string) (*Specialty, error) {
	var s Specialty
	err := db.QueryRowContext(ctx, `SELECT id, name, created_at FROM specialties WHERE id=?`, id).
		Scan(&s.ID, &s.Name, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func SpecialtyCreate(ctx context.Context, db *sql.DB, id, name string) (*Specialty, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx, `INSERT INTO specialties (id, name, created_at) VALUES (?, ?, ?)`, id, name, now)
	if err != nil {
		return nil, err
	}
	return SpecialtyFindByID(ctx, db, id)
}

func SpecialtyUpdate(ctx context.Context, db *sql.DB, id, name string) (*Specialty, error) {
	_, err := db.ExecContext(ctx, `UPDATE specialties SET name=? WHERE id=?`, name, id)
	if err != nil {
		return nil, err
	}
	return SpecialtyFindByID(ctx, db, id)
}

func SpecialtyDelete(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM specialties WHERE id=?`, id)
	return err
}

func SpecialtyIsInUse(ctx context.Context, db *sql.DB, id string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM professional_specialties WHERE specialty_id=?`, id).Scan(&count)
	return count > 0, err
}
