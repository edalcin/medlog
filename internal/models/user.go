package models

import (
	"context"
	"database/sql"
	"strings"
	"time"
)

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	Username      *string   `json:"username,omitempty"`
	Name          string    `json:"name"`
	Role          string    `json:"role"`
	Theme         string    `json:"theme"`
	BiologicalSex *string   `json:"biologicalSex"`
	BirthDate     *string   `json:"birthDate"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func UserFindByEmail(ctx context.Context, db *sql.DB, email string) (*User, string, error) {
	var u User
	var hash string
	err := db.QueryRowContext(ctx,
		// date(birth_date): a coluna é DATE e o driver a devolveria como
		// time.Time, o que serializa em RFC3339 e um <input type="date">
		// recusa. date() devolve TEXT AAAA-MM-DD, que é o contrato da API.
		`SELECT id, email, username, name, role, theme, biological_sex, date(birth_date), created_at, updated_at, password_hash
		 FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Theme, &u.BiologicalSex, &u.BirthDate, &u.CreatedAt, &u.UpdatedAt, &hash)
	if err != nil {
		return nil, "", err
	}
	return &u, hash, nil
}

func UserFindByID(ctx context.Context, db *sql.DB, id string) (*User, error) {
	var u User
	err := db.QueryRowContext(ctx,
		`SELECT id, email, username, name, role, theme, biological_sex, date(birth_date), created_at, updated_at FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Theme, &u.BiologicalSex, &u.BirthDate, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UserFindAll(ctx context.Context, db *sql.DB) ([]User, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, email, username, name, role, theme, biological_sex, date(birth_date), created_at, updated_at FROM users ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Theme, &u.BiologicalSex, &u.BirthDate, &u.CreatedAt, &u.UpdatedAt); err != nil {
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
	Name          *string
	Email         *string
	Role          *string
	Theme         *string
	BiologicalSex *string
	BirthDate     *string
}

func UserUpdate(ctx context.Context, db *sql.DB, id string, in UpdateUserInput) (*User, error) {
	var sets []string
	var args []any
	now := time.Now().UTC()

	if in.Name != nil {
		sets = append(sets, "name=?")
		args = append(args, *in.Name)
	}
	if in.Email != nil {
		sets = append(sets, "email=?")
		args = append(args, *in.Email)
	}
	if in.Role != nil {
		sets = append(sets, "role=?")
		args = append(args, *in.Role)
	}
	if in.Theme != nil {
		sets = append(sets, "theme=?")
		args = append(args, *in.Theme)
	}
	if in.BiologicalSex != nil {
		sets = append(sets, "biological_sex=?")
		args = append(args, *in.BiologicalSex)
	}
	if in.BirthDate != nil {
		sets = append(sets, "birth_date=?")
		args = append(args, *in.BirthDate)
	}
	if len(sets) == 0 {
		return UserFindByID(ctx, db, id)
	}
	sets = append(sets, "updated_at=?")
	args = append(args, now, id)

	if _, err := db.ExecContext(ctx,
		"UPDATE users SET "+strings.Join(sets, ",")+` WHERE id=?`, args...); err != nil {
		return nil, err
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

type UserSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func UserFindOthers(ctx context.Context, db *sql.DB, exceptID string) ([]UserSummary, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, name FROM users WHERE id != ? ORDER BY name`, exceptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []UserSummary
	for rows.Next() {
		var u UserSummary
		if err := rows.Scan(&u.ID, &u.Name); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	if list == nil {
		list = []UserSummary{}
	}
	return list, rows.Err()
}
