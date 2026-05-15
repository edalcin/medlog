package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/models"
)

type UserHandler struct{ DB *sql.DB }

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := models.UserFindAll(r.Context(), h.DB)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
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
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, u)
}

func (h *UserHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u, err := models.UserFindByID(r.Context(), h.DB, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeError(w, "db error", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, u)
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
			writeError(w, "db error", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, u)
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
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := models.UserDelete(r.Context(), h.DB, id); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
