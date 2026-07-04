package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	"medlog/internal/models"
)

type FileHandler struct {
	DB        *sql.DB
	FilesPath string
}

var allowedMIMETypes = map[string]string{
	"application/pdf": "pdf",
	"image/png":       "png",
	"image/jpeg":      "jpg",
}

func (h *FileHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	page, limit := parsePagination(r)
	offset := (page - 1) * limit

	opts := models.FileListOptions{
		CategoryID:     r.URL.Query().Get("categoryId"),
		ProfessionalID: r.URL.Query().Get("professionalId"),
		Sort:           r.URL.Query().Get("sort"),
		Dir:            r.URL.Query().Get("dir"),
	}

	var list []models.File
	var total int
	var err error

	if role == "ADMIN" {
		list, err = models.FileFindAllWithOpts(r.Context(), h.DB, limit, offset, opts)
		if err == nil {
			total, err = models.FileCountAllWithOpts(r.Context(), h.DB, opts)
		}
	} else {
		list, err = models.FileFindByOwner(r.Context(), h.DB, userID, limit, offset, opts)
		if err == nil {
			total, err = models.FileCountByOwner(r.Context(), h.DB, userID, opts)
		}
	}
	if err != nil {
		writeDBError(w, err)
		return
	}
	if list == nil {
		list = []models.File{}
	}
	writePagedJSON(w, list, total, page, limit)
}

func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, "file too large or invalid form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, "file required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	mimeType := header.Header.Get("Content-Type")
	ext, ok := allowedMIMETypes[mimeType]
	if !ok {
		writeError(w, "unsupported file type", http.StatusBadRequest)
		return
	}

	consultationID := formStringPtr(r, "consultationId")
	professionalID := formStringPtr(r, "professionalId")
	categoryIDs := r.Form["categoryIds"]

	customNameStr := r.FormValue("customName")
	var customName *string
	if customNameStr != "" {
		customName = &customNameStr
	}

	// Admin can upload on behalf of another user
	ownerUserID := userID
	if role == "ADMIN" {
		if ou := r.FormValue("ownerUserId"); ou != "" {
			ownerUserID = ou
		}
	}

	// Non-admin: verify the supplied consultation belongs to them
	if consultationID != nil && role != "ADMIN" {
		c, err := models.ConsultationFindByID(r.Context(), h.DB, *consultationID)
		if err != nil || c.UserID != userID {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	fileID := uuid.New().String()
	filename := fmt.Sprintf("%s.%s", fileID, ext)
	destPath := filepath.Join(h.FilesPath, filename)

	dest, err := os.Create(destPath)
	if err != nil {
		writeError(w, "could not save file", http.StatusInternalServerError)
		return
	}
	defer dest.Close()

	size, err := io.Copy(dest, file)
	if err != nil {
		os.Remove(destPath)
		writeError(w, "could not save file", http.StatusInternalServerError)
		return
	}

	in := models.CreateFileInput{
		ID:             fileID,
		Filename:       filename,
		CustomName:     customName,
		Path:           destPath,
		MimeType:       mimeType,
		Size:           size,
		ConsultationID: consultationID,
		ProfessionalID: professionalID,
		UserID:         &ownerUserID,
		CategoryIDs:    categoryIDs,
	}
	f, err := models.FileCreate(r.Context(), h.DB, in)
	if err != nil {
		os.Remove(destPath)
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"data": f})
}

func (h *FileHandler) Serve(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)

	filename := filepath.Base(chi.URLParam(r, "filename"))
	if filename == "." || filename == "/" || strings.Contains(filename, "..") {
		writeError(w, "invalid filename", http.StatusBadRequest)
		return
	}

	var path, mimeType, origFilename string
	var uploaderID, consultOwnerID sql.NullString
	err := h.DB.QueryRowContext(r.Context(),
		`SELECT f.path, f.mime_type, f.filename, f.user_id, c.user_id
		 FROM files f
		 LEFT JOIN consultations c ON c.id = f.consultation_id
		 WHERE f.filename=?`, filename).
		Scan(&path, &mimeType, &origFilename, &uploaderID, &consultOwnerID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}

	if role != "ADMIN" {
		isOwner := (uploaderID.Valid && uploaderID.String == userID) ||
			(consultOwnerID.Valid && consultOwnerID.String == userID)
		if !isOwner {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	f, err := os.Open(path)
	if err != nil {
		// Migrated files store bare filename in path column — try FilesPath prefix
		f, err = os.Open(filepath.Join(h.FilesPath, filepath.Base(path)))
		if err != nil {
			writeError(w, "file not found", http.StatusNotFound)
			return
		}
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		writeError(w, "file error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, origFilename, stat.ModTime(), f)
}

func (h *FileHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	id := chi.URLParam(r, "id")

	if role != "ADMIN" {
		owned, err := models.FileOwnerCheck(r.Context(), h.DB, id, userID)
		if err != nil {
			if err == sql.ErrNoRows {
				writeError(w, "not found", http.StatusNotFound)
			} else {
				writeDBError(w, err)
			}
			return
		}
		if !owned {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	var req struct {
		CustomName     *string  `json:"customName"`
		ConsultationID *string  `json:"consultationId"`
		ProfessionalID *string  `json:"professionalId"`
		CategoryIDs    []string `json:"categoryIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid body", http.StatusBadRequest)
		return
	}

	// Non-admin: verify the target consultation belongs to them
	if req.ConsultationID != nil && role != "ADMIN" {
		c, err := models.ConsultationFindByID(r.Context(), h.DB, *req.ConsultationID)
		if err != nil || c.UserID != userID {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	if req.CategoryIDs == nil {
		req.CategoryIDs = []string{}
	}

	f, err := models.FileUpdate(r.Context(), h.DB, id, models.UpdateFileInput{
		CustomName:     req.CustomName,
		ConsultationID: req.ConsultationID,
		ProfessionalID: req.ProfessionalID,
		CategoryIDs:    req.CategoryIDs,
	})
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": f})
}

func (h *FileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	id := chi.URLParam(r, "id")

	if role != "ADMIN" {
		owned, err := models.FileOwnerCheck(r.Context(), h.DB, id, userID)
		if err != nil {
			if err == sql.ErrNoRows {
				writeError(w, "not found", http.StatusNotFound)
			} else {
				writeDBError(w, err)
			}
			return
		}
		if !owned {
			writeError(w, "not found", http.StatusNotFound)
			return
		}
	}

	disassociated, err := models.FileDelete(r.Context(), h.DB, id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeDBError(w, err)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "disassociated": disassociated})
}

func formStringPtr(r *http.Request, key string) *string {
	v := r.FormValue(key)
	if v == "" {
		return nil
	}
	return &v
}
