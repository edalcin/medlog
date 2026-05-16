package models

import (
	"context"
	"database/sql"
	"time"
)

type Clinic struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address,omitempty"`
	UserID    *string   `json:"userId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func ClinicFindAll(ctx context.Context, db *sql.DB, userID string, isAdmin bool) ([]Clinic, error) {
	var q string
	var args []any
	if isAdmin {
		q = `SELECT id, name, address, user_id, created_at, updated_at FROM clinics ORDER BY name`
	} else {
		q = `SELECT id, name, address, user_id, created_at, updated_at FROM clinics WHERE user_id=? OR user_id IS NULL ORDER BY name`
		args = []any{userID}
	}
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Clinic
	for rows.Next() {
		var c Clinic
		if err := rows.Scan(&c.ID, &c.Name, &c.Address, &c.UserID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func ClinicFindByID(ctx context.Context, db *sql.DB, id string) (*Clinic, error) {
	var c Clinic
	err := db.QueryRowContext(ctx,
		`SELECT id, name, address, user_id, created_at, updated_at FROM clinics WHERE id=?`, id).
		Scan(&c.ID, &c.Name, &c.Address, &c.UserID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func ClinicCreate(ctx context.Context, db *sql.DB, id, name string, address *string, userID string) (*Clinic, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx,
		`INSERT INTO clinics (id, name, address, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, name, address, userID, now, now)
	if err != nil {
		return nil, err
	}
	return ClinicFindByID(ctx, db, id)
}

func ClinicUpdate(ctx context.Context, db *sql.DB, id, name string, address *string) (*Clinic, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx,
		`UPDATE clinics SET name=?, address=?, updated_at=? WHERE id=?`, name, address, now, id)
	if err != nil {
		return nil, err
	}
	return ClinicFindByID(ctx, db, id)
}

func ClinicDelete(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM clinics WHERE id=?`, id)
	return err
}

func ClinicIsInUse(ctx context.Context, db *sql.DB, id string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM professionals WHERE clinic_id=?`, id).Scan(&count)
	return count > 0, err
}
