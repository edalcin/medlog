package models

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"strings"
	"time"
)

type Consultation struct {
	ID             string        `json:"id"`
	Date           time.Time     `json:"-"` // serialised as YYYY-MM-DD via MarshalJSON
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

// consultationJSON is the wire format for Consultation.
// Date is emitted as "YYYY-MM-DD" so the client never needs to handle
// the UTC→local timezone shift that would occur with a full RFC3339 timestamp.
type consultationJSON struct {
	ID             string        `json:"id"`
	Date           string        `json:"date"`
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

func (c Consultation) MarshalJSON() ([]byte, error) {
	return json.Marshal(consultationJSON{
		ID:             c.ID,
		Date:           c.Date.UTC().Format("2006-01-02"),
		Proposito:      c.Proposito,
		Notes:          c.Notes,
		Type:           c.Type,
		Rating:         c.Rating,
		UserID:         c.UserID,
		ProfessionalID: c.ProfessionalID,
		Professional:   c.Professional,
		Files:          c.Files,
		CreatedAt:      c.CreatedAt,
		UpdatedAt:      c.UpdatedAt,
	})
}

func consultationBase(ctx context.Context, db *sql.DB, where string, args []any, limit, offset int) ([]Consultation, error) {
	q := `SELECT id, date, proposito, notes, type, rating, user_id, professional_id, created_at, updated_at
	      FROM consultations ` + where + ` ORDER BY date DESC`
	if limit > 0 {
		q += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Consultation
	profIDSet := map[string]bool{}
	var profIDs []string

	for rows.Next() {
		var c Consultation
		if err := rows.Scan(&c.ID, &c.Date, &c.Proposito, &c.Notes, &c.Type, &c.Rating,
			&c.UserID, &c.ProfessionalID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		c.Files = []File{}
		list = append(list, c)
		if c.ProfessionalID != nil && !profIDSet[*c.ProfessionalID] {
			profIDSet[*c.ProfessionalID] = true
			profIDs = append(profIDs, *c.ProfessionalID)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return list, nil
	}

	// Batch load professionals
	profMap := map[string]*Professional{}
	if len(profIDs) > 0 {
		pRows, err := db.QueryContext(ctx,
			`SELECT id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at
			 FROM professionals WHERE id IN `+inClause(len(profIDs)),
			anySlice(profIDs)...)
		if err != nil {
			slog.Error("consultationBase: batch load professionals", "err", err)
		} else {
			defer pRows.Close()
			var pIDs []string
			for pRows.Next() {
				var p Professional
				var isActive int
				if err := pRows.Scan(&p.ID, &p.Name, &p.CRM, &p.Address, &p.Notes, &isActive,
					&p.UserID, &p.ClinicID, &p.CreatedAt, &p.UpdatedAt); err != nil {
					slog.Error("consultationBase: scan professional", "err", err)
					continue
				}
				p.IsActive = isActive == 1
				p.Specialties = []Specialty{}
				profMap[p.ID] = &p
				pIDs = append(pIDs, p.ID)
			}
			// Batch load specialties for all professionals
			if len(pIDs) > 0 {
				specMap := professionalLoadSpecialtiesBatch(ctx, db, pIDs)
				for id, specs := range specMap {
					if prof, ok := profMap[id]; ok {
						prof.Specialties = specs
					}
				}
			}
		}
	}

	// Batch load files by consultation IDs
	consultIDs := make([]string, len(list))
	for i, c := range list {
		consultIDs[i] = c.ID
	}
	filesMap := map[string][]File{}

	fRows, err := db.QueryContext(ctx,
		`SELECT id, filename, custom_name, path, mime_type, size, hash, thumbnail_path,
		        consultation_id, professional_id, user_id, uploaded_at
		 FROM files WHERE consultation_id IN `+inClause(len(consultIDs))+` ORDER BY uploaded_at DESC`,
		anySlice(consultIDs)...)
	if err != nil {
		slog.Error("consultationBase: batch load files", "err", err)
	} else {
		defer fRows.Close()
		var allFiles []File
		var fileIDs []string
		for fRows.Next() {
			var f File
			if err := fRows.Scan(&f.ID, &f.Filename, &f.CustomName, &f.Path, &f.MimeType, &f.Size,
				&f.Hash, &f.ThumbnailPath, &f.ConsultationID, &f.ProfessionalID, &f.UserID, &f.UploadedAt); err != nil {
				slog.Error("consultationBase: scan file", "err", err)
				continue
			}
			f.Categories = []FileCategory{}
			allFiles = append(allFiles, f)
			fileIDs = append(fileIDs, f.ID)
		}
		// Batch load categories for all files
		if len(fileIDs) > 0 {
			catMap := fileLoadCategoriesBatch(ctx, db, fileIDs)
			for i, f := range allFiles {
				if cats, ok := catMap[f.ID]; ok {
					allFiles[i].Categories = cats
				}
			}
		}
		for _, f := range allFiles {
			if f.ConsultationID != nil {
				filesMap[*f.ConsultationID] = append(filesMap[*f.ConsultationID], f)
			}
		}
	}

	// Assemble
	for i := range list {
		if list[i].ProfessionalID != nil {
			list[i].Professional = profMap[*list[i].ProfessionalID]
		}
		if files, ok := filesMap[list[i].ID]; ok {
			list[i].Files = files
		}
	}

	return list, nil
}

func ConsultationFindByUserID(ctx context.Context, db *sql.DB, userID string, limit, offset int) ([]Consultation, error) {
	return consultationBase(ctx, db, "WHERE user_id=?", []any{userID}, limit, offset)
}

func ConsultationFindAll(ctx context.Context, db *sql.DB, limit, offset int) ([]Consultation, error) {
	return consultationBase(ctx, db, "", nil, limit, offset)
}

func ConsultationFindByID(ctx context.Context, db *sql.DB, id string) (*Consultation, error) {
	list, err := consultationBase(ctx, db, "WHERE id=?", []any{id}, 1, 0)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, sql.ErrNoRows
	}
	return &list[0], nil
}

func ConsultationCountByUserID(ctx context.Context, db *sql.DB, userID string) (int, error) {
	var n int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM consultations WHERE user_id=?", userID).Scan(&n)
	return n, err
}

func ConsultationCountAll(ctx context.Context, db *sql.DB) (int, error) {
	var n int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM consultations").Scan(&n)
	return n, err
}

// buildConsultationFilter constructs the WHERE clause and args for filtered queries.
func buildConsultationFilter(userID string, isAdmin bool, professionalID, specialtyID string) (string, []any) {
	var conds []string
	var args []any
	if !isAdmin {
		conds = append(conds, "user_id=?")
		args = append(args, userID)
	}
	if professionalID != "" {
		conds = append(conds, "professional_id=?")
		args = append(args, professionalID)
	}
	if specialtyID != "" {
		conds = append(conds, "professional_id IN (SELECT professional_id FROM professional_specialties WHERE specialty_id=?)")
		args = append(args, specialtyID)
	}
	if len(conds) == 0 {
		return "", nil
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

func ConsultationFindFiltered(ctx context.Context, db *sql.DB, userID string, isAdmin bool, professionalID, specialtyID string, limit, offset int) ([]Consultation, error) {
	where, args := buildConsultationFilter(userID, isAdmin, professionalID, specialtyID)
	return consultationBase(ctx, db, where, args, limit, offset)
}

func ConsultationCountFiltered(ctx context.Context, db *sql.DB, userID string, isAdmin bool, professionalID, specialtyID string) (int, error) {
	where, args := buildConsultationFilter(userID, isAdmin, professionalID, specialtyID)
	var n int
	q := "SELECT COUNT(*) FROM consultations " + where
	err := db.QueryRowContext(ctx, q, args...).Scan(&n)
	return n, err
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
	var sets []string
	var args []any
	now := time.Now().UTC()

	if in.Date != nil {
		sets = append(sets, "date=?")
		args = append(args, *in.Date)
	}
	if in.Proposito != nil {
		sets = append(sets, "proposito=?")
		args = append(args, *in.Proposito)
	}
	if in.Notes != nil {
		sets = append(sets, "notes=?")
		args = append(args, *in.Notes)
	}
	if in.Type != nil {
		sets = append(sets, "type=?")
		args = append(args, *in.Type)
	}
	if in.Rating != nil {
		sets = append(sets, "rating=?")
		args = append(args, *in.Rating)
	}
	if in.ProfessionalID != nil {
		sets = append(sets, "professional_id=?")
		args = append(args, *in.ProfessionalID)
	}
	if len(sets) == 0 {
		return ConsultationFindByID(ctx, db, id)
	}
	sets = append(sets, "updated_at=?")
	args = append(args, now, id)

	if _, err := db.ExecContext(ctx,
		"UPDATE consultations SET "+strings.Join(sets, ",")+` WHERE id=?`, args...); err != nil {
		return nil, err
	}
	return ConsultationFindByID(ctx, db, id)
}

func ConsultationDelete(ctx context.Context, db *sql.DB, id, filesPath string) error {
	rows, err := db.QueryContext(ctx, "SELECT path FROM files WHERE consultation_id=?", id)
	if err != nil {
		slog.Error("ConsultationDelete: list file paths", "id", id, "err", err)
	} else {
		defer rows.Close()
		var paths []string
		for rows.Next() {
			var p string
			if err := rows.Scan(&p); err != nil {
				slog.Error("ConsultationDelete: scan path", "err", err)
				continue
			}
			paths = append(paths, p)
		}
		for _, p := range paths {
			if err := removeFile(p); err != nil {
				slog.Error("ConsultationDelete: remove file", "path", p, "err", err)
			}
		}
	}
	_, err = db.ExecContext(ctx, "DELETE FROM consultations WHERE id=?", id)
	return err
}
