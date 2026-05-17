package models

import (
	"context"
	"database/sql"
	"time"
)

type Sharing struct {
	ID               string    `json:"id"`
	SharingFromUserID string   `json:"sharingFromUserId"`
	SharingToUserID   string   `json:"sharingToUserId"`
	CreatedAt        time.Time `json:"createdAt"`
}

// ProfessionalSharedFromUsers returns the user IDs of users who share professionals with toUserID.
func ProfessionalSharedFromUsers(ctx context.Context, db *sql.DB, toUserID string) ([]string, error) {
	return sharingFromUsers(ctx, db, "user_professional_sharing", toUserID)
}

// ClinicSharedFromUsers returns the user IDs of users who share clinics with toUserID.
func ClinicSharedFromUsers(ctx context.Context, db *sql.DB, toUserID string) ([]string, error) {
	return sharingFromUsers(ctx, db, "user_clinic_sharing", toUserID)
}

func sharingFromUsers(ctx context.Context, db *sql.DB, table, toUserID string) ([]string, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT sharing_from_user_id FROM `+table+` WHERE sharing_to_user_id=?`, toUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ProfessionalSharingFindByUser returns all sharing records where fromUserID is the owner.
func ProfessionalSharingFindByUser(ctx context.Context, db *sql.DB, fromUserID string) ([]Sharing, error) {
	return sharingFindByOwner(ctx, db, "user_professional_sharing", fromUserID)
}

// ClinicSharingFindByUser returns all sharing records where fromUserID is the owner.
func ClinicSharingFindByUser(ctx context.Context, db *sql.DB, fromUserID string) ([]Sharing, error) {
	return sharingFindByOwner(ctx, db, "user_clinic_sharing", fromUserID)
}

func sharingFindByOwner(ctx context.Context, db *sql.DB, table, fromUserID string) ([]Sharing, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, sharing_from_user_id, sharing_to_user_id, created_at
		 FROM `+table+` WHERE sharing_from_user_id=? ORDER BY created_at`, fromUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []Sharing
	for rows.Next() {
		var s Sharing
		if err := rows.Scan(&s.ID, &s.SharingFromUserID, &s.SharingToUserID, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	if list == nil {
		list = []Sharing{}
	}
	return list, rows.Err()
}

func ProfessionalSharingCreate(ctx context.Context, db *sql.DB, id, fromUserID, toUserID string) (*Sharing, error) {
	return sharingCreate(ctx, db, "user_professional_sharing", id, fromUserID, toUserID)
}

func ClinicSharingCreate(ctx context.Context, db *sql.DB, id, fromUserID, toUserID string) (*Sharing, error) {
	return sharingCreate(ctx, db, "user_clinic_sharing", id, fromUserID, toUserID)
}

func sharingCreate(ctx context.Context, db *sql.DB, table, id, fromUserID, toUserID string) (*Sharing, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx,
		`INSERT INTO `+table+` (id, sharing_from_user_id, sharing_to_user_id, created_at)
		 VALUES (?, ?, ?, ?)`, id, fromUserID, toUserID, now)
	if err != nil {
		return nil, err
	}
	var s Sharing
	err = db.QueryRowContext(ctx,
		`SELECT id, sharing_from_user_id, sharing_to_user_id, created_at FROM `+table+` WHERE id=?`, id).
		Scan(&s.ID, &s.SharingFromUserID, &s.SharingToUserID, &s.CreatedAt)
	return &s, err
}

func ProfessionalSharingDelete(ctx context.Context, db *sql.DB, fromUserID, toUserID string) error {
	return sharingDelete(ctx, db, "user_professional_sharing", fromUserID, toUserID)
}

func ClinicSharingDelete(ctx context.Context, db *sql.DB, fromUserID, toUserID string) error {
	return sharingDelete(ctx, db, "user_clinic_sharing", fromUserID, toUserID)
}

func sharingDelete(ctx context.Context, db *sql.DB, table, fromUserID, toUserID string) error {
	_, err := db.ExecContext(ctx,
		`DELETE FROM `+table+` WHERE sharing_from_user_id=? AND sharing_to_user_id=?`, fromUserID, toUserID)
	return err
}
