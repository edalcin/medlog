package models

import (
	"context"
	"database/sql"
	"time"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Username  *string   `json:"username,omitempty"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Theme     string    `json:"theme"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func UserFindByEmail(ctx context.Context, db *sql.DB, email string) (*User, string, error) {
	var u User
	var hash string
	err := db.QueryRowContext(ctx,
		`SELECT id, email, username, name, role, theme, created_at, updated_at, password_hash
		 FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Theme, &u.CreatedAt, &u.UpdatedAt, &hash)
	if err != nil {
		return nil, "", err
	}
	return &u, hash, nil
}

func UserFindByID(ctx context.Context, db *sql.DB, id string) (*User, error) {
	var u User
	err := db.QueryRowContext(ctx,
		`SELECT id, email, username, name, role, theme, created_at, updated_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Theme, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UserFindAll(ctx context.Context, db *sql.DB) ([]User, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, email, username, name, role, theme, created_at, updated_at FROM users ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Theme, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func UserCount(ctx context.Context, db *sql.DB) (int, error) {
	var count int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	return count, err
}

type CreateUserInput struct {
	Email        string
	Name         string
	PasswordHash string
	Role         string
	Theme        string
}

func UserCreate(ctx context.Context, db *sql.DB, id string, in CreateUserInput) (*User, error) {
	now := time.Now().UTC()
	_, err := db.ExecContext(ctx,
		`INSERT INTO users (id, email, name, password_hash, role, theme, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, in.Email, in.Name, in.PasswordHash, in.Role, in.Theme, now, now,
	)
	if err != nil {
		return nil, err
	}
	return UserFindByID(ctx, db, id)
}

type UpdateUserInput struct {
	Name  *string
	Email *string
	Role  *string
	Theme *string
}

func UserUpdate(ctx context.Context, db *sql.DB, id string, in UpdateUserInput) (*User, error) {
	now := time.Now().UTC()
	if in.Name != nil {
		db.ExecContext(ctx, "UPDATE users SET name=?, updated_at=? WHERE id=?", *in.Name, now, id)
	}
	if in.Email != nil {
		db.ExecContext(ctx, "UPDATE users SET email=?, updated_at=? WHERE id=?", *in.Email, now, id)
	}
	if in.Role != nil {
		db.ExecContext(ctx, "UPDATE users SET role=?, updated_at=? WHERE id=?", *in.Role, now, id)
	}
	if in.Theme != nil {
		db.ExecContext(ctx, "UPDATE users SET theme=?, updated_at=? WHERE id=?", *in.Theme, now, id)
	}
	return UserFindByID(ctx, db, id)
}

func UserUpdatePassword(ctx context.Context, db *sql.DB, id, hash string) error {
	_, err := db.ExecContext(ctx, "UPDATE users SET password_hash=?, updated_at=? WHERE id=?",
		hash, time.Now().UTC(), id)
	return err
}

func UserDelete(ctx context.Context, db *sql.DB, id string) error {
	_, err := db.ExecContext(ctx, "DELETE FROM users WHERE id=?", id)
	return err
}
