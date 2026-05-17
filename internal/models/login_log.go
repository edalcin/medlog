package models

import (
	"context"
	"database/sql"
	"time"
)

type LoginLog struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	UserName  string    `json:"userName"`
	UserEmail string    `json:"userEmail"`
	Timestamp time.Time `json:"timestamp"`
	IPAddress *string   `json:"ipAddress,omitempty"`
	UserAgent *string   `json:"userAgent,omitempty"`
}

func LoginLogFindAll(ctx context.Context, db *sql.DB, limit, offset int) ([]LoginLog, int, error) {
	var total int
	if err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM login_logs").Scan(&total); err != nil {
		return nil, 0, err
	}

	q := `SELECT id, user_id, user_name, user_email, timestamp, ip_address, user_agent
	      FROM login_logs ORDER BY timestamp DESC`
	var args []any
	if limit > 0 {
		q += " LIMIT ? OFFSET ?"
		args = append(args, limit, offset)
	}
	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []LoginLog
	for rows.Next() {
		var l LoginLog
		if err := rows.Scan(&l.ID, &l.UserID, &l.UserName, &l.UserEmail,
			&l.Timestamp, &l.IPAddress, &l.UserAgent); err != nil {
			return nil, 0, err
		}
		list = append(list, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if list == nil {
		list = []LoginLog{}
	}
	return list, total, nil
}
