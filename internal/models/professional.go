package models

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

type ConsultationRef struct {
	ID   string    `json:"id"`
	Date time.Time `json:"date"`
}

type Professional struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	CRM           *string           `json:"crm,omitempty"`
	Address       *string           `json:"address,omitempty"`
	Notes         *string           `json:"notes,omitempty"`
	IsActive      bool              `json:"isActive"`
	IsShared      bool              `json:"isShared"`
	UserID        *string           `json:"userId,omitempty"`
	ClinicID      *string           `json:"clinicId,omitempty"`
	Clinic        *Clinic           `json:"clinic,omitempty"`
	Specialties   []Specialty       `json:"specialties"`
	Consultations []ConsultationRef `json:"consultations"`
	CreatedAt     time.Time         `json:"createdAt"`
	UpdatedAt     time.Time         `json:"updatedAt"`
}

func newID() string {
	return uuid.New().String()
}

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

func professionalLoadClinicsBatch(ctx context.Context, db *sql.DB, clinicIDs []string) map[string]*Clinic {
	result := map[string]*Clinic{}
	if len(clinicIDs) == 0 {
		return result
	}
	rows, err := db.QueryContext(ctx,
		`SELECT id, name, address, user_id, created_at, updated_at FROM clinics WHERE id IN `+inClause(len(clinicIDs)),
		anySlice(clinicIDs)...)
	if err != nil {
		slog.Error("batch load clinics", "err", err)
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var c Clinic
		if err := rows.Scan(&c.ID, &c.Name, &c.Address, &c.UserID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			slog.Error("scan clinic", "err", err)
			continue
		}
		result[c.ID] = &c
	}
	return result
}

func professionalLoadConsultationsBatch(ctx context.Context, db *sql.DB, profIDs []string, userID string, isAdmin bool) map[string][]ConsultationRef {
	result := map[string][]ConsultationRef{}
	if len(profIDs) == 0 {
		return result
	}
	q := `SELECT professional_id, id, date FROM consultations WHERE professional_id IN ` + inClause(len(profIDs))
	args := anySlice(profIDs)
	if !isAdmin && userID != "" {
		q += ` AND user_id=?`
		args = append(args, userID)
	}
	q += ` ORDER BY date ASC`
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		slog.Error("batch load consultations", "err", err)
		return result
	}
	defer rows.Close()
	for rows.Next() {
		var profID string
		var c ConsultationRef
		if err := rows.Scan(&profID, &c.ID, &c.Date); err != nil {
			slog.Error("scan consultation ref", "err", err)
			continue
		}
		result[profID] = append(result[profID], c)
	}
	return result
}

func professionalAttachRelations(ctx context.Context, db *sql.DB, list []Professional, profIDs []string, userID string, isAdmin bool) []Professional {
	if len(profIDs) == 0 {
		return list
	}
	specMap := professionalLoadSpecialtiesBatch(ctx, db, profIDs)

	var clinicIDs []string
	clinicIDSet := map[string]bool{}
	for _, p := range list {
		if p.ClinicID != nil && !clinicIDSet[*p.ClinicID] {
			clinicIDSet[*p.ClinicID] = true
			clinicIDs = append(clinicIDs, *p.ClinicID)
		}
	}
	clinicMap := professionalLoadClinicsBatch(ctx, db, clinicIDs)
	consultMap := professionalLoadConsultationsBatch(ctx, db, profIDs, userID, isAdmin)

	for i := range list {
		if specs, ok := specMap[list[i].ID]; ok {
			list[i].Specialties = specs
		}
		if list[i].ClinicID != nil {
			if c, ok := clinicMap[*list[i].ClinicID]; ok {
				list[i].Clinic = c
			}
		}
		if consults, ok := consultMap[list[i].ID]; ok {
			list[i].Consultations = consults
		} else {
			list[i].Consultations = []ConsultationRef{}
		}
	}
	return list
}

func ProfessionalCount(ctx context.Context, db *sql.DB, userID string, isAdmin bool, activeOnly bool, search, specialtyID, clinicID string) (int, error) {
	var n int

	activeFilter := ""
	if activeOnly {
		activeFilter = " AND is_active=1"
	}
	searchFilter := ""
	if search != "" {
		searchFilter = " AND name LIKE ?"
	}
	specialtyFilter, specialtyFilterP := "", ""
	if specialtyID != "" {
		specialtyFilter = " AND id IN (SELECT professional_id FROM professional_specialties WHERE specialty_id=?)"
		specialtyFilterP = " AND p.id IN (SELECT professional_id FROM professional_specialties WHERE specialty_id=?)"
	}
	clinicFilter, clinicFilterP := "", ""
	if clinicID != "" {
		clinicFilter = " AND clinic_id=?"
		clinicFilterP = " AND p.clinic_id=?"
	}

	buildBranchArgs := func(uid string) []any {
		var args []any
		if uid != "" {
			args = append(args, uid)
		}
		if search != "" {
			args = append(args, "%"+search+"%")
		}
		if specialtyID != "" {
			args = append(args, specialtyID)
		}
		if clinicID != "" {
			args = append(args, clinicID)
		}
		return args
	}

	var err error
	if isAdmin {
		q := "SELECT COUNT(*) FROM professionals WHERE 1=1" + activeFilter + searchFilter + specialtyFilter + clinicFilter
		err = db.QueryRowContext(ctx, q, buildBranchArgs("")...).Scan(&n)
	} else {
		a1 := buildBranchArgs(userID)
		a2 := buildBranchArgs(userID)
		allArgs := append(a1, a2...)
		q := `SELECT COUNT(*) FROM (
			SELECT id FROM professionals WHERE (user_id=? OR user_id IS NULL)` + activeFilter + searchFilter + specialtyFilter + clinicFilter + `
			UNION ALL
			SELECT p.id FROM professionals p
			JOIN user_professional_sharing s ON s.sharing_from_user_id = p.user_id
			WHERE s.sharing_to_user_id=?` + activeFilter + searchFilter + specialtyFilterP + clinicFilterP + `
		)`
		err = db.QueryRowContext(ctx, q, allArgs...).Scan(&n)
	}
	return n, err
}

func ProfessionalFindAll(ctx context.Context, db *sql.DB, userID string, isAdmin bool, activeOnly bool, search, specialtyID, clinicID string, limit, offset int) ([]Professional, error) {
	var q string
	var args []any

	activeFilter := ""
	if activeOnly {
		activeFilter = " AND is_active=1"
	}
	searchFilter := ""
	if search != "" {
		searchFilter = " AND name LIKE ?"
	}
	specialtyFilter, specialtyFilterP := "", ""
	if specialtyID != "" {
		specialtyFilter = " AND id IN (SELECT professional_id FROM professional_specialties WHERE specialty_id=?)"
		specialtyFilterP = " AND p.id IN (SELECT professional_id FROM professional_specialties WHERE specialty_id=?)"
	}
	clinicFilter, clinicFilterP := "", ""
	if clinicID != "" {
		clinicFilter = " AND clinic_id=?"
		clinicFilterP = " AND p.clinic_id=?"
	}

	scanRow := func(rows *sql.Rows) (Professional, error) {
		var p Professional
		var isActive, isShared int
		err := rows.Scan(&p.ID, &p.Name, &p.CRM, &p.Address, &p.Notes, &isActive,
			&p.UserID, &p.ClinicID, &p.CreatedAt, &p.UpdatedAt, &isShared)
		p.IsActive = isActive == 1
		p.IsShared = isShared == 1
		p.Specialties = []Specialty{}
		p.Consultations = []ConsultationRef{}
		return p, err
	}

	buildBranchArgs := func(uid string) []any {
		var a []any
		if uid != "" {
			a = append(a, uid)
		}
		if search != "" {
			a = append(a, "%"+search+"%")
		}
		if specialtyID != "" {
			a = append(a, specialtyID)
		}
		if clinicID != "" {
			a = append(a, clinicID)
		}
		return a
	}

	if isAdmin {
		q = `SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at, 0 AS is_shared
			FROM professionals WHERE 1=1` + activeFilter + searchFilter + specialtyFilter + clinicFilter
		args = buildBranchArgs("")
		q += " ORDER BY name"
		if limit > 0 {
			q += " LIMIT ? OFFSET ?"
			args = append(args, limit, offset)
		}
	} else {
		a1 := buildBranchArgs(userID)
		a2 := buildBranchArgs(userID)
		args = append(a1, a2...)

		inner := `SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at, 0 AS is_shared
			FROM professionals WHERE (user_id=? OR user_id IS NULL)` + activeFilter + searchFilter + specialtyFilter + clinicFilter + `
			UNION ALL
			SELECT p.id, p.name, p.crm, p.address, p.notes, p.is_active, p.user_id, p.clinic_id, p.created_at, p.updated_at, 1 AS is_shared
			FROM professionals p
			JOIN user_professional_sharing s ON s.sharing_from_user_id = p.user_id
			WHERE s.sharing_to_user_id=?` + activeFilter + searchFilter + specialtyFilterP + clinicFilterP

		if limit > 0 {
			q = `SELECT * FROM (` + inner + `) ORDER BY name LIMIT ? OFFSET ?`
			args = append(args, limit, offset)
		} else {
			q = `SELECT * FROM (` + inner + `) ORDER BY name`
		}
	}

	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Professional
	var profIDs []string
	for rows.Next() {
		p, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
		profIDs = append(profIDs, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	list = professionalAttachRelations(ctx, db, list, profIDs, userID, isAdmin)
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
	p.Specialties = []Specialty{}
	p.Consultations = []ConsultationRef{}

	specMap := professionalLoadSpecialtiesBatch(ctx, db, []string{p.ID})
	if specs, ok := specMap[p.ID]; ok {
		p.Specialties = specs
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
