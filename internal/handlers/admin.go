package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"medlog/internal/models"
)

type AdminHandler struct {
	DB        *sql.DB
	FilesPath string
}

func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	counts := map[string]int{}
	tables := []string{"users", "consultations", "professionals", "files", "specialties", "clinics", "file_categories"}
	for _, t := range tables {
		var n int
		h.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+t).Scan(&n)
		counts[t] = n
	}
	writeJSON(w, http.StatusOK, counts)
}

func (h *AdminHandler) ListConsultations(w http.ResponseWriter, r *http.Request) {
	list, err := models.ConsultationFindAll(r.Context(), h.DB)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []models.Consultation{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *AdminHandler) BulkDeleteConsultations(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IDs) == 0 {
		writeError(w, "ids required", http.StatusBadRequest)
		return
	}
	for _, id := range req.IDs {
		models.ConsultationDelete(r.Context(), h.DB, id, h.FilesPath)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *AdminHandler) ListProfessionals(w http.ResponseWriter, r *http.Request) {
	list, err := models.ProfessionalFindAll(r.Context(), h.DB, "", false)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []models.Professional{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

func (h *AdminHandler) BulkDeleteProfessionals(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.IDs) == 0 {
		writeError(w, "ids required", http.StatusBadRequest)
		return
	}
	for _, id := range req.IDs {
		hasConsult, err := models.ProfessionalHasConsultations(r.Context(), h.DB, id)
		if err != nil {
			writeError(w, "db error", http.StatusInternalServerError)
			return
		}
		if hasConsult {
			writeError(w, "professional has consultations", http.StatusConflict)
			return
		}
	}
	for _, id := range req.IDs {
		models.ProfessionalDelete(r.Context(), h.DB, id)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *AdminHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	list, err := models.FileFindAll(r.Context(), h.DB)
	if err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	if list == nil {
		list = []models.File{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}
