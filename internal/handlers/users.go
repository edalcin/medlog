package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/auth"

	"medlog/internal/models"
)

type UserHandler struct{ DB *sql.DB }

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := models.UserFindAll(r.Context(), h.DB)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.User{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Theme    string `json:"theme"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Name == "" || req.Password == "" {
		writeError(w, "email, name, and password required", http.StatusBadRequest)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if req.Role == "" {
		req.Role = "USER"
	}
	if req.Theme == "" {
		req.Theme = "SYSTEM"
	}
	in := models.CreateUserInput{
		Email:        req.Email,
		Name:         req.Name,
		PasswordHash: string(hash),
		Role:         req.Role,
		Theme:        req.Theme,
	}
	u, err := models.UserCreate(r.Context(), h.DB, uuid.New().String(), in)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": u})
}

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u, err := models.UserFindByID(r.Context(), h.DB, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": u})
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name  *string `json:"name"`
		Email *string `json:"email"`
		Role  *string `json:"role"`
		Theme *string `json:"theme"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}
	in := models.UpdateUserInput{
		Name:  req.Name,
		Email: req.Email,
		Role:  req.Role,
		Theme: req.Theme,
	}
	u, err := models.UserUpdate(r.Context(), h.DB, id, in)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": u})
}

func (h *UserHandler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		writeError(w, "password required", http.StatusBadRequest)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := models.UserUpdatePassword(r.Context(), h.DB, id, string(hash)); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := models.UserDelete(r.Context(), h.DB, id); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *UserHandler) ListOthers(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	list, err := models.UserFindOthers(r.Context(), h.DB, userID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *UserHandler) MeUpdateTheme(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		Theme string `json:"theme"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Theme != "LIGHT" && req.Theme != "DARK" && req.Theme != "SYSTEM" {
		writeError(w, "theme must be LIGHT, DARK, or SYSTEM", http.StatusBadRequest)
		return
	}
	u, err := models.UserUpdate(r.Context(), h.DB, userID, models.UpdateUserInput{Theme: &req.Theme})
	if err != nil {
		writeDBError(w, err)
		return
	}
	auth.Manager.Put(r.Context(), auth.SessionKeyTheme, req.Theme)
	writeJSON(w, http.StatusOK, map[string]any{"data": u})
}

func (h *UserHandler) MeUpdatePassword(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		writeError(w, "currentPassword and newPassword required", http.StatusBadRequest)
		return
	}
	if len(req.NewPassword) < 8 {
		writeError(w, "newPassword must be at least 8 characters", http.StatusBadRequest)
		return
	}

	var currentHash string
	if err := h.DB.QueryRowContext(r.Context(),
		"SELECT password_hash FROM users WHERE id=?", userID).Scan(&currentHash); err != nil {
		writeDBError(w, err)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
		writeError(w, "current password is incorrect", http.StatusUnauthorized)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := models.UserUpdatePassword(r.Context(), h.DB, userID, string(hash)); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// MeUpdate atualiza o perfil do próprio usuário logado (nome, e-mail, sexo
// biológico e data de nascimento). O e-mail é a credencial de login, então
// trocá-lo exige confirmar a senha atual (ADR 0014).
func (h *UserHandler) MeUpdate(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		Name            *string `json:"name"`
		Email           *string `json:"email"`
		BiologicalSex   *string `json:"biologicalSex"`
		BirthDate       *string `json:"birthDate"`
		CurrentPassword *string `json:"currentPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "requisição inválida", http.StatusBadRequest)
		return
	}

	if req.BiologicalSex != nil && *req.BiologicalSex != "M" && *req.BiologicalSex != "F" {
		writeError(w, "sexo biológico deve ser M ou F", http.StatusBadRequest)
		return
	}

	if req.BirthDate != nil {
		birth, err := time.Parse("2006-01-02", *req.BirthDate)
		if err != nil {
			writeError(w, "data de nascimento deve estar no formato AAAA-MM-DD", http.StatusBadRequest)
			return
		}
		now := time.Now().UTC()
		if !birth.Before(now) {
			writeError(w, "data de nascimento não pode ser no futuro", http.StatusBadRequest)
			return
		}
		if birth.Before(now.AddDate(-130, 0, 0)) {
			writeError(w, "data de nascimento implausível", http.StatusBadRequest)
			return
		}
	}

	// A senha só é exigida quando o e-mail de fato muda. O formulário de
	// Configurações manda o e-mail em toda gravação, então comparar com o
	// gravado é o que separa "trocar credencial" de "salvar sexo e nascimento".
	if req.Email != nil {
		var currentHash, currentEmail string
		if err := h.DB.QueryRowContext(r.Context(),
			"SELECT password_hash, email FROM users WHERE id=?", userID).Scan(&currentHash, &currentEmail); err != nil {
			writeDBError(w, err)
			return
		}
		if *req.Email != currentEmail {
			if req.CurrentPassword == nil || *req.CurrentPassword == "" {
				writeError(w, "senha atual é obrigatória para trocar o e-mail", http.StatusBadRequest)
				return
			}
			if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(*req.CurrentPassword)); err != nil {
				writeError(w, "senha atual incorreta", http.StatusUnauthorized)
				return
			}
		}
	}

	in := models.UpdateUserInput{
		Name:          req.Name,
		Email:         req.Email,
		BiologicalSex: req.BiologicalSex,
		BirthDate:     req.BirthDate,
	}
	u, err := models.UserUpdate(r.Context(), h.DB, userID, in)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			writeError(w, "e-mail já está em uso", http.StatusConflict)
			return
		}
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": u})
}
