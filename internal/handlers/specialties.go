package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/models"
)

type SpecialtyHandler struct{ DB *sql.DB }

func (h *SpecialtyHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := models.SpecialtyFindAll(r.Context(), h.DB)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []models.Specialty{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *SpecialtyHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	s, err := models.SpecialtyCreate(r.Context(), h.DB, uuid.New().String(), req.Name)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, s)
}

func (h *SpecialtyHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	s, err := models.SpecialtyUpdate(r.Context(), h.DB, id, req.Name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeError(w, "db error", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, s)
}

func (h *SpecialtyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	inUse, err := models.SpecialtyIsInUse(r.Context(), h.DB, id)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if inUse {
		writeError(w, "in use", http.StatusConflict)
		return
	}
	if err := models.SpecialtyDelete(r.Context(), h.DB, id); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
