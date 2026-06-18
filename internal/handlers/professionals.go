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

type ProfessionalHandler struct {
	DB        *sql.DB
	FilesPath string
}

func (h *ProfessionalHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	activeOnly := r.URL.Query().Get("active") == "true"
	search := r.URL.Query().Get("search")
	specialtyID := r.URL.Query().Get("specialtyId")
	clinicID := r.URL.Query().Get("clinicId")
	isAdmin := role == "ADMIN"

	var page, limit, offset int
	if r.URL.Query().Get("all") == "true" {
		// Dropdown/select use-case: return all matching records, no pagination cap.
		// limit=0 bypasses the SQL LIMIT clause in ProfessionalFindAll.
		page = 1
	} else {
		page, limit = parsePagination(r)
		offset = (page - 1) * limit
	}

	list, err := models.ProfessionalFindAll(r.Context(), h.DB, userID, isAdmin, activeOnly, search, specialtyID, clinicID, limit, offset)
	if err != nil {
		writeDBError(w, err)
		return
	}
	total, err := models.ProfessionalCount(r.Context(), h.DB, userID, isAdmin, activeOnly, search, specialtyID, clinicID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.Professional{}
	}
	writePagedJSON(w, list, total, page, limit)
}

func (h *ProfessionalHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	var req struct {
		Name         string   `json:"name"`
		CRM          *string  `json:"crm"`
		Address      *string  `json:"address"`
		Notes        *string  `json:"notes"`
		IsActive     bool     `json:"isActive"`
		ClinicID     *string  `json:"clinicId"`
		SpecialtyIDs []string `json:"specialtyIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	p := models.Professional{
		Name: req.Name, CRM: req.CRM, Address: req.Address,
		Notes: req.Notes, IsActive: req.IsActive, ClinicID: req.ClinicID,
		UserID: &userID,
	}
	result, err := models.ProfessionalCreate(r.Context(), h.DB, uuid.New().String(), p, req.SpecialtyIDs)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": result})
}

func (h *ProfessionalHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := models.ProfessionalFindByID(r.Context(), h.DB, id)
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

func (h *ProfessionalHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		Name         string   `json:"name"`
		CRM          *string  `json:"crm"`
		Address      *string  `json:"address"`
		Notes        *string  `json:"notes"`
		IsActive     bool     `json:"isActive"`
		ClinicID     *string  `json:"clinicId"`
		SpecialtyIDs []string `json:"specialtyIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		writeError(w, "name required", http.StatusBadRequest)
		return
	}
	p := models.Professional{
		Name: req.Name, CRM: req.CRM, Address: req.Address,
		Notes: req.Notes, IsActive: req.IsActive, ClinicID: req.ClinicID,
	}
	result, err := models.ProfessionalUpdate(r.Context(), h.DB, id, p, req.SpecialtyIDs)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}

func (h *ProfessionalHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	hasConsult, err := models.ProfessionalHasConsultations(r.Context(), h.DB, id)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if hasConsult {
		writeError(w, "professional has consultations", http.StatusConflict)
		return
	}
	if err := models.ProfessionalDelete(r.Context(), h.DB, id); err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
