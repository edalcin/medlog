package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/auth"
)

type AuthHandler struct{ DB *sql.DB }

func (h *AuthHandler) SignIn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}

	var user struct {
		ID           string
		Name         string
		Email        string
		Role         string
		Theme        string
		PasswordHash string
	}
	err := h.DB.QueryRowContext(r.Context(),
		"SELECT id, name, email, role, theme, password_hash FROM users WHERE email = ?",
		req.Email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.Theme, &user.PasswordHash)
	if err != nil {
		writeError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err := auth.Manager.RenewToken(r.Context()); err != nil {
		writeError(w, "session error", http.StatusInternalServerError)
		return
	}
	auth.Manager.Put(r.Context(), auth.SessionKeyUserID, user.ID)
	auth.Manager.Put(r.Context(), auth.SessionKeyRole, user.Role)
	auth.Manager.Put(r.Context(), auth.SessionKeyName, user.Name)
	auth.Manager.Put(r.Context(), auth.SessionKeyEmail, user.Email)
	auth.Manager.Put(r.Context(), auth.SessionKeyTheme, user.Theme)

	userAgent := r.Header.Get("User-Agent")
	ip := r.RemoteAddr
	_, _ = h.DB.ExecContext(r.Context(),
		"INSERT INTO login_logs (id, user_id, user_name, user_email, timestamp, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
		uuid.New().String(), user.ID, user.Name, user.Email, time.Now().UTC(), ip, userAgent,
	)

	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{
		"id": user.ID, "email": user.Email, "name": user.Name, "role": user.Role, "theme": user.Theme,
	}})
}

func (h *AuthHandler) SignOut(w http.ResponseWriter, r *http.Request) {
	if err := auth.Manager.Destroy(r.Context()); err != nil {
		writeError(w, "session error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]string{
		"id":    auth.Manager.GetString(r.Context(), auth.SessionKeyUserID),
		"email": auth.Manager.GetString(r.Context(), auth.SessionKeyEmail),
		"name":  auth.Manager.GetString(r.Context(), auth.SessionKeyName),
		"role":  auth.Manager.GetString(r.Context(), auth.SessionKeyRole),
		"theme": auth.Manager.GetString(r.Context(), auth.SessionKeyTheme),
	}})
}
