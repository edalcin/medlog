package models

import (
	"context"
	"database/sql"
	"time"
)

type Phone struct {
	ID             string    `json:"id"`
	Number         string    `json:"number"`
	Label          *string   `json:"label,omitempty"`
	ProfessionalID *string   `json:"professionalId,omitempty"`
	ClinicID       *string   `json:"clinicId,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

func PhoneFindByProfessionalID(ctx context.Context, db *sql.DB, professionalID string) ([]Phone, error) {
	return phoneFindBy(ctx, db, "professional_id", professionalID)
}

func PhoneFindByClinicID(ctx context.Context, db *sql.DB, clinicID string) ([]Phone, error) {
	return phoneFindBy(ctx, db, "clinic_id", clinicID)
}

func phoneFindBy(ctx context.Context, db *sql.DB, col, val string) ([]Phone, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, number, label, professional_id, clinic_id, created_at
		 FROM phones WHERE `+col+`=? ORDER BY created_at`, val)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Phone
	for rows.Next() {
		var p Phone
		if err := rows.Scan(&p.ID, &p.Number, &p.Label, &p.ProfessionalID, &p.ClinicID, &p.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if list == nil {
		list = []Phone{}
	}
	return list, nil
}

func PhoneCreate(ctx context.Context, db *sql.DB, id, number string, label *string, professionalID, clinicID *string) (*Phone, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx,
		`INSERT INTO phones (id, number, label, professional_id, clinic_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id, number, label, professionalID, clinicID, now)
	if err != nil {
		return nil, err
	}
	var p Phone
	err = db.QueryRowContext(ctx,
		`SELECT id, number, label, professional_id, clinic_id, created_at FROM phones WHERE id=?`, id).
		Scan(&p.ID, &p.Number, &p.Label, &p.ProfessionalID, &p.ClinicID, &p.CreatedAt)
	return &p, err
}

func PhoneUpdate(ctx context.Context, db *sql.DB, id, number string, label *string) (*Phone, error) {
	_, err := db.ExecContext(ctx, `UPDATE phones SET number=?, label=? WHERE id=?`, number, label, id)
	if err != nil {
		return nil, err
	}
	var p Phone
	err = db.QueryRowContext(ctx,
		`SELECT id, number, label, professional_id, clinic_id, created_at FROM phones WHERE id=?`, id).
		Scan(&p.ID, &p.Number, &p.Label, &p.ProfessionalID, &p.ClinicID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func PhoneDelete(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM phones WHERE id=?`, id)
	return err
}

// PhoneBelongsToUser returns true if the phone's parent professional/clinic is owned by userID,
// or if the phone has no associated owner (admin bypass handled at handler level).
func PhoneBelongsToUser(ctx context.Context, db *sql.DB, phoneID, userID string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM phones p
		LEFT JOIN professionals pr ON pr.id = p.professional_id
		LEFT JOIN clinics c ON c.id = p.clinic_id
		WHERE p.id=? AND (pr.user_id=? OR c.user_id=?)`,
		phoneID, userID, userID).Scan(&count)
	return count > 0, err
}
