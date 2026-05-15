package models

import (
	"context"
	"database/sql"
	"time"
)

type Consultation struct {
	ID             string        `json:"id"`
	Date           time.Time     `json:"date"`
	Proposito      *string       `json:"proposito,omitempty"`
	Notes          *string       `json:"notes,omitempty"`
	Type           string        `json:"type"`
	Rating         *int          `json:"rating,omitempty"`
	UserID         string        `json:"userId"`
	ProfessionalID *string       `json:"professionalId,omitempty"`
	Professional   *Professional `json:"professional,omitempty"`
	Files          []File        `json:"files"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
}

func consultationBase(ctx context.Context, db *sql.DB, where string, args []any) ([]Consultation, error) {
	q := `SELECT id, date, proposito, notes, type, rating, user_id, professional_id, created_at, updated_at
	      FROM consultations ` + where + ` ORDER BY date DESC`
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Consultation
	for rows.Next() {
		var c Consultation
		if err := rows.Scan(&c.ID, &c.Date, &c.Proposito, &c.Notes, &c.Type, &c.Rating,
			&c.UserID, &c.ProfessionalID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if c.ProfessionalID != nil {
			c.Professional, _ = ProfessionalFindByID(ctx, db, *c.ProfessionalID)
		}
		c.Files, _ = FileFindByConsultationID(ctx, db, c.ID)
		if c.Files == nil {
			c.Files = []File{}
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func ConsultationFindByUserID(ctx context.Context, db *sql.DB, userID string) ([]Consultation, error) {
	return consultationBase(ctx, db, "WHERE user_id=?", []any{userID})
}

func ConsultationFindAll(ctx context.Context, db *sql.DB) ([]Consultation, error) {
	return consultationBase(ctx, db, "", nil)
}

func ConsultationFindByID(ctx context.Context, db *sql.DB, id string) (*Consultation, error) {
	list, err := consultationBase(ctx, db, "WHERE id=?", []any{id})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, sql.ErrNoRows
	}
	return &list[0], nil
}

type CreateConsultationInput struct {
	Date           time.Time
	Proposito      *string
	Notes          *string
	Type           string
	Rating         *int
	UserID         string
	ProfessionalID *string
}

func ConsultationCreate(ctx context.Context, db *sql.DB, id string, in CreateConsultationInput) (*Consultation, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx,
		`INSERT INTO consultations (id, date, proposito, notes, type, rating, user_id, professional_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, in.Date, in.Proposito, in.Notes, in.Type, in.Rating, in.UserID, in.ProfessionalID, now, now)
	if err != nil {
		return nil, err
	}
	return ConsultationFindByID(ctx, db, id)
}

type UpdateConsultationInput struct {
	Date           *time.Time
	Proposito      *string
	Notes          *string
	Type           *string
	Rating         *int
	ProfessionalID *string
}

func ConsultationUpdate(ctx context.Context, db *sql.DB, id string, in UpdateConsultationInput) (*Consultation, error) {
	now := time.Now().UTC()
	if in.Date != nil {
		db.ExecContext(ctx, "UPDATE consultations SET date=?, updated_at=? WHERE id=?", *in.Date, now, id)
	}
	if in.Proposito != nil {
		db.ExecContext(ctx, "UPDATE consultations SET proposito=?, updated_at=? WHERE id=?", *in.Proposito, now, id)
	}
	if in.Notes != nil {
		db.ExecContext(ctx, "UPDATE consultations SET notes=?, updated_at=? WHERE id=?", *in.Notes, now, id)
	}
	if in.Type != nil {
		db.ExecContext(ctx, "UPDATE consultations SET type=?, updated_at=? WHERE id=?", *in.Type, now, id)
	}
	if in.Rating != nil {
		db.ExecContext(ctx, "UPDATE consultations SET rating=?, updated_at=? WHERE id=?", *in.Rating, now, id)
	}
	if in.ProfessionalID != nil {
		db.ExecContext(ctx, "UPDATE consultations SET professional_id=?, updated_at=? WHERE id=?", *in.ProfessionalID, now, id)
	}
	return ConsultationFindByID(ctx, db, id)
}

func ConsultationDelete(ctx context.Context, db *sql.DB, id, filesPath string) error {
	rows, err := db.QueryContext(ctx, "SELECT path FROM files WHERE consultation_id=?", id)
	if err == nil {
		defer rows.Close()
		var paths []string
		for rows.Next() {
			var p string
			rows.Scan(&p)
			paths = append(paths, p)
		}
		for _, p := range paths {
			_ = removeFile(p)
		}
	}
	_, err = db.ExecContext(ctx, "DELETE FROM consultations WHERE id=?", id)
	return err
}
