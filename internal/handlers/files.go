package handlers

import (
	"database/sql"
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

func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)

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
		UserID:         &userID,
		CategoryIDs:    categoryIDs,
	}
	f, err := models.FileCreate(r.Context(), h.DB, in)
	if err != nil {
		os.Remove(destPath)
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, f)
}

func (h *FileHandler) Serve(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	if userID == "" {
		writeError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	filename := filepath.Base(chi.URLParam(r, "filename"))
	if filename == "." || filename == "/" || strings.Contains(filename, "..") {
		writeError(w, "invalid filename", http.StatusBadRequest)
		return
	}

	var path, mimeType, origFilename string
	err := h.DB.QueryRowContext(r.Context(),
		"SELECT path, mime_type, filename FROM files WHERE filename=?", filename).
		Scan(&path, &mimeType, &origFilename)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeError(w, "db error", http.StatusInternalServerError)
		}
		return
	}

	f, err := os.Open(path)
	if err != nil {
		writeError(w, "file not found", http.StatusNotFound)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		writeError(w, "file error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, origFilename, stat.ModTime(), f)
}

func (h *FileHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := models.FileDelete(r.Context(), h.DB, id); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, "not found", http.StatusNotFound)
		} else {
			writeError(w, "db error", http.StatusInternalServerError)
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func formStringPtr(r *http.Request, key string) *string {
	v := r.FormValue(key)
	if v == "" {
		return nil
	}
	return &v
}

