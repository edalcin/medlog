package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	"medlog/internal/models"
)

type ConsultationHandler struct {
	DB        *sql.DB
	FilesPath string
}

func (h *ConsultationHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)

	page, limit := parsePagination(r)
	offset := (page - 1) * limit

	var list []models.Consultation
	var total int
	var err error
	if role == "ADMIN" {
		list, err = models.ConsultationFindAll(r.Context(), h.DB, limit, offset)
		if err == nil {
			total, err = models.ConsultationCountAll(r.Context(), h.DB)
		}
	} else {
		list, err = models.ConsultationFindByUserID(r.Context(), h.DB, userID, limit, offset)
		if err == nil {
			total, err = models.ConsultationCountByUserID(r.Context(), h.DB, userID)
		}
	}
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.Consultation{}
	}
	writePagedJSON(w, list, total, page, limit)
}

func (h *ConsultationHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		Date           string  `json:"date"`
		Proposito      *string `json:"proposito"`
		Notes          *string `json:"notes"`
		Type           string  `json:"type"`
		Rating         *int    `json:"rating"`
		ProfessionalID *string `json:"professionalId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}
	date, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		date, err = time.Parse("2006-01-02", req.Date)
		if err != nil {
			writeError(w, "invalid date format", http.StatusBadRequest)
			return
		}
	}
	if req.Type == "" {
		req.Type = "CONSULTA"
	}
	in := models.CreateConsultationInput{
		Date:           date,
		Proposito:      req.Proposito,
		Notes:          req.Notes,
		Type:           req.Type,
		Rating:         req.Rating,
		UserID:         userID,
		ProfessionalID: req.ProfessionalID,
	}
	c, err := models.ConsultationCreate(r.Context(), h.DB, uuid.New().String(), in)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": c})
}

func (h *ConsultationHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)

	c, err := models.ConsultationFindByID(r.Context(), h.DB, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	if role != "ADMIN" && c.UserID != userID {
		writeError(w, "not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *ConsultationHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)

	existing, err := models.ConsultationFindByID(r.Context(), h.DB, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	if role != "ADMIN" && existing.UserID != userID {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	var req struct {
		Date           *string `json:"date"`
		Proposito      *string `json:"proposito"`
		Notes          *string `json:"notes"`
		Type           *string `json:"type"`
		Rating         *int    `json:"rating"`
		ProfessionalID *string `json:"professionalId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request", http.StatusBadRequest)
		return
	}

	in := models.UpdateConsultationInput{
		Proposito:      req.Proposito,
		Notes:          req.Notes,
		Type:           req.Type,
		Rating:         req.Rating,
		ProfessionalID: req.ProfessionalID,
	}
	if req.Date != nil {
		d, err := time.Parse(time.RFC3339, *req.Date)
		if err != nil {
			d, err = time.Parse("2006-01-02", *req.Date)
			if err != nil {
				writeError(w, "invalid date format", http.StatusBadRequest)
				return
			}
		}
		in.Date = &d
	}

	c, err := models.ConsultationUpdate(r.Context(), h.DB, id, in)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": c})
}

func (h *ConsultationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)

	existing, err := models.ConsultationFindByID(r.Context(), h.DB, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	if role != "ADMIN" && existing.UserID != userID {
		writeError(w, "not found", http.StatusNotFound)
		return
	}

	if err := models.ConsultationDelete(r.Context(), h.DB, id, h.FilesPath); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
