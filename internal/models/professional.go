package models

import (
	"context"
	"database/sql"
	"log/slog"
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
	IsShared    bool        `json:"isShared"`
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

// professionalLoadSpecialtiesBatch loads specialties for multiple professionals in one query.
// Returns a map from professional ID to its specialties.
func professionalLoadSpecialtiesBatch(ctx context.Context, db *sql.DB, profIDs []string) map[string][]Specialty {
	result := map[string][]Specialty{}
	if len(profIDs) == 0 {
		return result
	}
	rows, err := db.QueryContext(ctx,
		`SELECT ps.professional_id, s.id, s.name, s.created_at
		 FROM professional_specialties ps
		 JOIN specialties s ON s.id = ps.specialty_id
		 WHERE ps.professional_id IN `+inClause(len(profIDs))+`
		 ORDER BY s.name`,
		anySlice(profIDs)...)
	if err != nil {
		slog.Error("batch load specialties", "err", err)
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var profID string
		var s Specialty
		if err := rows.Scan(&profID, &s.ID, &s.Name, &s.CreatedAt); err != nil {
			slog.Error("scan specialty", "err", err)
			continue
		}
		result[profID] = append(result[profID], s)
	}
	return result
}

func ProfessionalCount(ctx context.Context, db *sql.DB, userID string, isAdmin bool, activeOnly bool, search string) (int, error) {
	var n int
	var err error
	activeFilter := ""
	if activeOnly {
		activeFilter = " AND is_active=1"
	}
	searchFilter := ""
	var searchArg string
	if search != "" {
		searchFilter = " AND name LIKE ?"
		searchArg = "%" + search + "%"
	}
	if isAdmin {
		q := "SELECT COUNT(*) FROM professionals WHERE 1=1" + activeFilter + searchFilter
		if search != "" {
			err = db.QueryRowContext(ctx, q, searchArg).Scan(&n)
		} else {
			err = db.QueryRowContext(ctx, q).Scan(&n)
		}
	} else {
		q := `SELECT COUNT(*) FROM (
			SELECT id FROM professionals WHERE (user_id=? OR user_id IS NULL)` + activeFilter + searchFilter + `
			UNION ALL
			SELECT p.id FROM professionals p
			JOIN user_professional_sharing s ON s.sharing_from_user_id = p.user_id
			WHERE s.sharing_to_user_id=?` + activeFilter + searchFilter + `
		)`
		if search != "" {
			err = db.QueryRowContext(ctx, q, userID, searchArg, userID, searchArg).Scan(&n)
		} else {
			err = db.QueryRowContext(ctx, q, userID, userID).Scan(&n)
		}
	}
	return n, err
}

func ProfessionalFindAll(ctx context.Context, db *sql.DB, userID string, isAdmin bool, activeOnly bool, search string, limit, offset int) ([]Professional, error) {
	var q string
	var args []any
	activeFilter := ""
	if activeOnly {
		activeFilter = " AND is_active=1"
	}
	searchFilter := ""
	var searchArg string
	if search != "" {
		searchFilter = " AND name LIKE ?"
		searchArg = "%" + search + "%"
	}
	if isAdmin {
		q = `SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at, 0 AS is_shared
		     FROM professionals WHERE 1=1` + activeFilter + searchFilter
		if search != "" {
			args = []any{searchArg}
		}
	} else {
		// Own professionals + shared from other users (tagged with is_shared=1)
		q = `SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at, 0 AS is_shared
		     FROM professionals WHERE (user_id=? OR user_id IS NULL)` + activeFilter + searchFilter + `
		     UNION ALL
		     SELECT p.id, p.name, p.crm, p.address, p.notes, p.is_active, p.user_id, p.clinic_id, p.created_at, p.updated_at, 1 AS is_shared
		     FROM professionals p
		     JOIN user_professional_sharing s ON s.sharing_from_user_id = p.user_id
		     WHERE s.sharing_to_user_id=?` + activeFilter + searchFilter
		if search != "" {
			args = []any{userID, searchArg, userID, searchArg}
		} else {
			args = []any{userID, userID}
		}
		if limit > 0 {
			q = `SELECT * FROM (` + q + `) ORDER BY name LIMIT ? OFFSET ?`
			args = append(args, limit, offset)
		} else {
			q = `SELECT * FROM (` + q + `) ORDER BY name`
		}

		rows, err := db.QueryContext(ctx, q, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		var list []Professional
		var profIDs []string
		for rows.Next() {
			var p Professional
			var isActive, isShared int
			if err := rows.Scan(&p.ID, &p.Name, &p.CRM, &p.Address, &p.Notes, &isActive,
				&p.UserID, &p.ClinicID, &p.CreatedAt, &p.UpdatedAt, &isShared); err != nil {
				return nil, err
			}
			p.IsActive = isActive == 1
			p.IsShared = isShared == 1
			p.Specialties = []Specialty{}
			list = append(list, p)
			profIDs = append(profIDs, p.ID)
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		if len(profIDs) > 0 {
			specMap := professionalLoadSpecialtiesBatch(ctx, db, profIDs)
			for i := range list {
				if specs, ok := specMap[list[i].ID]; ok {
					list[i].Specialties = specs
				}
			}
		}
		return list, nil
	}
	q += " ORDER BY name"
	if limit > 0 {
		q += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}

	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Professional
	var profIDs []string
	for rows.Next() {
		var p Professional
		var isActive, isShared int
		if err := rows.Scan(&p.ID, &p.Name, &p.CRM, &p.Address, &p.Notes, &isActive,
			&p.UserID, &p.ClinicID, &p.CreatedAt, &p.UpdatedAt, &isShared); err != nil {
			return nil, err
		}
		p.IsActive = isActive == 1
		p.IsShared = isShared == 1
		p.Specialties = []Specialty{}
		list = append(list, p)
		profIDs = append(profIDs, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(profIDs) > 0 {
		specMap := professionalLoadSpecialtiesBatch(ctx, db, profIDs)
		for i := range list {
			if specs, ok := specMap[list[i].ID]; ok {
				list[i].Specialties = specs
			}
		}
	}

	return list, nil
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

	specMap := professionalLoadSpecialtiesBatch(ctx, db, []string{p.ID})
	if specs, ok := specMap[p.ID]; ok {
		p.Specialties = specs
	} else {
		p.Specialties = []Specialty{}
	}

	if p.ClinicID != nil {
		clinic, err := ClinicFindByID(ctx, db, *p.ClinicID)
		if err != nil {
			slog.Error("ProfessionalFindByID: load clinic", "clinicId", *p.ClinicID, "err", err)
		} else {
			p.Clinic = clinic
		}
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
	if _, err := tx.ExecContext(ctx, `DELETE FROM professional_specialties WHERE professional_id=?`, id); err != nil {
		slog.Error("ProfessionalUpdate: delete specialties", "id", id, "err", err)
	}
	for _, sid := range specialtyIDs {
		if _, err := tx.ExecContext(ctx,
			`INSERT OR IGNORE INTO professional_specialties (id, professional_id, specialty_id, created_at) VALUES (?, ?, ?, ?)`,
			newID(), id, sid, now); err != nil {
			slog.Error("ProfessionalUpdate: insert specialty", "id", id, "specialtyId", sid, "err", err)
		}
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
