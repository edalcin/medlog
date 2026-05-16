package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	"medlog/internal/models"
)

type ClinicHandler struct{ DB *sql.DB }

func (h *ClinicHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	list, err := models.ClinicFindAll(r.Context(), h.DB, userID, role == "ADMIN")
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []models.Clinic{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *ClinicHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		Name    string  `json:"name"`
		Address *string `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	c, err := models.ClinicCreate(r.Context(), h.DB, uuid.New().String(), req.Name, req.Address, userID)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *ClinicHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name    string  `json:"name"`
		Address *string `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	c, err := models.ClinicUpdate(r.Context(), h.DB, id, req.Name, req.Address)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeError(w, "db error", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, c)
}

func (h *ClinicHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	inUse, err := models.ClinicIsInUse(r.Context(), h.DB, id)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if inUse {
		writeError(w, "in use", http.StatusConflict)
		return
	}
	if err := models.ClinicDelete(r.Context(), h.DB, id); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
