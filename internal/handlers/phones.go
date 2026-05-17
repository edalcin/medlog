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

type PhoneHandler struct{ DB *sql.DB }

func (h *PhoneHandler) ListByProfessional(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	list, err := models.PhoneFindByProfessionalID(r.Context(), h.DB, id)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *PhoneHandler) ListByClinic(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	list, err := models.PhoneFindByClinicID(r.Context(), h.DB, id)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *PhoneHandler) CreateForProfessional(w http.ResponseWriter, r *http.Request) {
	professionalID := chi.URLParam(r, "id")
	h.create(w, r, &professionalID, nil)
}

func (h *PhoneHandler) CreateForClinic(w http.ResponseWriter, r *http.Request) {
	clinicID := chi.URLParam(r, "id")
	h.create(w, r, nil, &clinicID)
}

func (h *PhoneHandler) create(w http.ResponseWriter, r *http.Request, professionalID, clinicID *string) {
	var req struct {
		Number string  `json:"number"`
		Label  *string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Number == "" {
		writeError(w, "number required", http.StatusBadRequest)
		return
	}
	p, err := models.PhoneCreate(r.Context(), h.DB, uuid.New().String(), req.Number, req.Label, professionalID, clinicID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": p})
}

func (h *PhoneHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)

	if role != "ADMIN" {
		ok, err := models.PhoneBelongsToUser(r.Context(), h.DB, id, userID)
		if err != nil {
			writeDBError(w, err)
			return
		}
		if !ok {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	var req struct {
		Number string  `json:"number"`
		Label  *string `json:"label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Number == "" {
		writeError(w, "number required", http.StatusBadRequest)
		return
	}
	p, err := models.PhoneUpdate(r.Context(), h.DB, id, req.Number, req.Label)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": p})
}

func (h *PhoneHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)

	if role != "ADMIN" {
		ok, err := models.PhoneBelongsToUser(r.Context(), h.DB, id, userID)
		if err != nil {
			writeDBError(w, err)
			return
		}
		if !ok {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	if err := models.PhoneDelete(r.Context(), h.DB, id); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
