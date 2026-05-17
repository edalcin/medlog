package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	"medlog/internal/models"
)

type SharingHandler struct{ DB *sql.DB }

func (h *SharingHandler) ListProfessionalSharing(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	list, err := models.ProfessionalSharingFindByUser(r.Context(), h.DB, userID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *SharingHandler) CreateProfessionalSharing(w http.ResponseWriter, r *http.Request) {
	fromUserID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		ToUserID string `json:"toUserId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ToUserID == "" {
		writeError(w, "toUserId required", http.StatusBadRequest)
		return
	}
	s, err := models.ProfessionalSharingCreate(r.Context(), h.DB, uuid.New().String(), fromUserID, req.ToUserID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": s})
}

func (h *SharingHandler) DeleteProfessionalSharing(w http.ResponseWriter, r *http.Request) {
	fromUserID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	toUserID := chi.URLParam(r, "userId")
	if err := models.ProfessionalSharingDelete(r.Context(), h.DB, fromUserID, toUserID); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *SharingHandler) ListClinicSharing(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	list, err := models.ClinicSharingFindByUser(r.Context(), h.DB, userID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *SharingHandler) CreateClinicSharing(w http.ResponseWriter, r *http.Request) {
	fromUserID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		ToUserID string `json:"toUserId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ToUserID == "" {
		writeError(w, "toUserId required", http.StatusBadRequest)
		return
	}
	s, err := models.ClinicSharingCreate(r.Context(), h.DB, uuid.New().String(), fromUserID, req.ToUserID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": s})
}

func (h *SharingHandler) DeleteClinicSharing(w http.ResponseWriter, r *http.Request) {
	fromUserID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	toUserID := chi.URLParam(r, "userId")
	if err := models.ClinicSharingDelete(r.Context(), h.DB, fromUserID, toUserID); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
