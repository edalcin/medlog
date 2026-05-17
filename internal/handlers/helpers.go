package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, msg string, status int) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeDBError(w http.ResponseWriter, err error) {
	slog.Error("db error", "err", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
}

func parsePagination(r *http.Request) (page, limit int) {
	page = 1
	limit = 20
	if p, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		if l > 100 {
			l = 100
		}
		limit = l
	}
	return page, limit
}

func writePagedJSON(w http.ResponseWriter, data any, total, page, limit int) {
	writeJSON(w, http.StatusOK, map[string]any{
		"data":  data,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
