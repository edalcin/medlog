package models

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
)

type Professional struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	CRM         *string     `json:"crm,omitempty"`
	Address     *string     `json:"address,omitempty"`
	Notes       *string     `json:"notes,omitempty"`
	IsActive    bool        `json:"isActive"`
	UserID      *string     `json:"userId,omitempty"`
	ClinicID    *string     `json:"clinicId,omitempty"`
	Clinic      *Clinic     `json:"clinic,omitempty"`
	Specialties []Specialty `json:"specialties"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

func newID() string {
	return uuid.New().String()
}

func professionalLoadSpecialties(ctx context.Context, db *sql.DB, profID string) ([]Specialty, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT s.id, s.name, s.created_at
		 FROM specialties s
		 JOIN professional_specialties ps ON ps.specialty_id = s.id
		 WHERE ps.professional_id = ?
		 ORDER BY s.name`, profID)
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

func ProfessionalFindAll(ctx context.Context, db *sql.DB, userID string, isAdmin bool, activeOnly bool) ([]Professional, error) {
	var q string
	var args []any
	if isAdmin {
		q = `SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at
		     FROM professionals WHERE 1=1`
	} else {
		q = `SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at
		     FROM professionals WHERE (user_id=? OR user_id IS NULL)`
		args = []any{userID}
	}
	if activeOnly {
		q += " AND is_active=1"
	}
	q += " ORDER BY name"
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Professional
	for rows.Next() {
		var p Professional
		var isActive int
		if err := rows.Scan(&p.ID, &p.Name, &p.CRM, &p.Address, &p.Notes, &isActive,
			&p.UserID, &p.ClinicID, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.IsActive = isActive == 1
		p.Specialties, _ = professionalLoadSpecialties(ctx, db, p.ID)
		list = append(list, p)
	}
	return list, rows.Err()
}

func ProfessionalFindByID(ctx context.Context, db *sql.DB, id string) (*Professional, error) {
	var p Professional
	var isActive int
	err := db.QueryRowContext(ctx,
		`SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at
		 FROM professionals WHERE id=?`, id).
		Scan(&p.ID, &p.Name, &p.CRM, &p.Address, &p.Notes, &isActive,
			&p.UserID, &p.ClinicID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	p.IsActive = isActive == 1
	p.Specialties, _ = professionalLoadSpecialties(ctx, db, p.ID)
	if p.ClinicID != nil {
		p.Clinic, _ = ClinicFindByID(ctx, db, *p.ClinicID)
	}
	return &p, nil
}

func ProfessionalCreate(ctx context.Context, db *sql.DB, id string, p Professional, specialtyIDs []string) (*Professional, error) {
	now := time.Now().UTC()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	isActive := 1
	if !p.IsActive {
		isActive = 0
	}
	_, err = tx.ExecContext(ctx,
		`INSERT INTO professionals (id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.Name, p.CRM, p.Address, p.Notes, isActive, p.UserID, p.ClinicID, now, now)
	if err != nil {
		return nil, err
	}
	for _, sid := range specialtyIDs {
		_, err = tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO professional_specialties (id, professional_id, specialty_id, created_at) VALUES (?, ?, ?, ?)`,
			newID(), id, sid, now)
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return ProfessionalFindByID(ctx, db, id)
}

func ProfessionalUpdate(ctx context.Context, db *sql.DB, id string, p Professional, specialtyIDs []string) (*Professional, error) {
	now := time.Now().UTC()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	isActive := 1
	if !p.IsActive {
		isActive = 0
	}
	_, err = tx.ExecContext(ctx,
		`UPDATE professionals SET name=?, crm=?, address=?, notes=?, is_active=?, clinic_id=?, updated_at=? WHERE id=?`,
		p.Name, p.CRM, p.Address, p.Notes, isActive, p.ClinicID, now, id)
	if err != nil {
		return nil, err
	}
	_, _ = tx.ExecContext(ctx, `DELETE FROM professional_specialties WHERE professional_id=?`, id)
	for _, sid := range specialtyIDs {
		_, _ = tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO professional_specialties (id, professional_id, specialty_id, created_at) VALUES (?, ?, ?, ?)`,
			newID(), id, sid, now)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return ProfessionalFindByID(ctx, db, id)
}

func ProfessionalDelete(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM professionals WHERE id=?`, id)
	return err
}

func ProfessionalHasConsultations(ctx context.Context, db *sql.DB, id string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM consultations WHERE professional_id=?`, id).Scan(&count)
	return count > 0, err
}
