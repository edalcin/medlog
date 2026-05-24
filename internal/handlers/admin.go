package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"medlog/internal/models"
)

type AdminHandler struct {
	DB        *sql.DB
	FilesPath string
	DBPath    string
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
	writeJSON(w, http.StatusOK, map[string]any{"data": counts})
}

func (h *AdminHandler) ListConsultations(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePagination(r)
	offset := (page - 1) * limit
	list, err := models.ConsultationFindAll(r.Context(), h.DB, limit, offset)
	if err != nil {
		writeDBError(w, err)
		return
	}
	total, err := models.ConsultationCountAll(r.Context(), h.DB)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.Consultation{}
	}
	writePagedJSON(w, list, total, page, limit)
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
	page, limit := parsePagination(r)
	offset := (page - 1) * limit
	list, err := models.ProfessionalFindAll(r.Context(), h.DB, "", true, false, "", "", "", limit, offset)
	if err != nil {
		writeDBError(w, err)
		return
	}
	total, err := models.ProfessionalCount(r.Context(), h.DB, "", true, false, "", "", "")
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.Professional{}
	}
	writePagedJSON(w, list, total, page, limit)
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
			writeDBError(w, err)
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

func (h *AdminHandler) ListLoginLogs(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePagination(r)
	offset := (page - 1) * limit
	list, total, err := models.LoginLogFindAll(r.Context(), h.DB, limit, offset)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writePagedJSON(w, list, total, page, limit)
}

func (h *AdminHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePagination(r)
	offset := (page - 1) * limit
	list, err := models.FileFindAll(r.Context(), h.DB, limit, offset)
	if err != nil {
		writeDBError(w, err)
		return
	}
	total, err := models.FileCount(r.Context(), h.DB)
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.File{}
	}
	writePagedJSON(w, list, total, page, limit)
}

// Backup serves the SQLite database file as a downloadable attachment.
// It flushes the WAL before streaming so the backup is consistent.
func (h *AdminHandler) Backup(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if _, err := h.DB.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		writeError(w, "checkpoint failed", http.StatusInternalServerError)
		return
	}

	f, err := os.Open(h.DBPath)
	if err != nil {
		writeError(w, "cannot open database file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	filename := fmt.Sprintf("medlog-backup-%s.sqlite", time.Now().Format("20060102"))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	io.Copy(w, f)
}

// sqliteMagic is the 16-byte header that every valid SQLite 3 database begins with.
var sqliteMagic = []byte("SQLite format 3\x00")

// Restore replaces the live database with an uploaded SQLite file.
// Steps: validate magic bytes → write to temp file → flush WAL → delete WAL/SHM
// → atomic rename → re-ping DB to verify connectivity.
func (h *AdminHandler) Restore(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, "multipart parse failed", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, "file field required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, "read upload failed", http.StatusInternalServerError)
		return
	}

	if len(data) < 16 || string(data[:16]) != string(sqliteMagic) {
		writeError(w, "not a valid SQLite database", http.StatusBadRequest)
		return
	}

	dir := filepath.Dir(h.DBPath)
	tmp, err := os.CreateTemp(dir, "medlog-restore-*.sqlite")
	if err != nil {
		writeError(w, "cannot create temp file", http.StatusInternalServerError)
		return
	}
	tmpName := tmp.Name()

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		writeError(w, "write temp file failed", http.StatusInternalServerError)
		return
	}
	tmp.Close()

	// Invalidate all active sessions so users must log in again after restore.
	h.DB.ExecContext(ctx, "DELETE FROM sessions")

	// Flush WAL into the main database file before replacing it.
	h.DB.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)")

	// Remove WAL and SHM sidecar files; they will be recreated on next write.
	os.Remove(h.DBPath + "-wal")
	os.Remove(h.DBPath + "-shm")

	if err := os.Rename(tmpName, h.DBPath); err != nil {
		os.Remove(tmpName)
		writeError(w, "replace database failed", http.StatusInternalServerError)
		return
	}

	if err := h.DB.PingContext(ctx); err != nil {
		writeError(w, "database reconnect failed", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Restauração concluída. Faça login novamente.",
	})
}
