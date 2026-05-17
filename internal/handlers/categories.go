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

type CategoryHandler struct{ DB *sql.DB }

func (h *CategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := models.CategoryFindAll(r.Context(), h.DB)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.FileCategory{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *CategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	c, err := models.CategoryCreate(r.Context(), h.DB, uuid.New().String(), req.Name)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": c})
}

func (h *CategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	c, err := models.CategoryUpdate(r.Context(), h.DB, id, req.Name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *CategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	inUse, err := models.CategoryIsInUse(r.Context(), h.DB, id)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if inUse {
		writeError(w, "in use", http.StatusConflict)
		return
	}
	if err := models.CategoryDelete(r.Context(), h.DB, id); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
