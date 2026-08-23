package handlers

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"

	"medlog/internal/auth"
	"medlog/internal/models"
)

// SeriesHandler serves the confirmed time series of health indicators. Unlike
// extraction, these routes are not ADMIN-only: reading your own indicators is
// ordinary use. The user of the session is the only scope, so nobody reads
// another person's series (family sharing covers professionals, not results).
type SeriesHandler struct {
	DB *sql.DB
}

// Index lists the indicators the signed-in user has confirmed data for.
func (h *SeriesHandler) Index(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	list, err := models.IndicatorSeriesIndex(r.Context(), h.DB, userID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}

// Series returns one indicator's confirmed observations, oldest first. The
// non-numeric ones travel too: the screen lists them instead of plotting them.
func (h *SeriesHandler) Series(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	list, err := models.ObservationFindSeries(r.Context(), h.DB, userID, chi.URLParam(r, "code"))
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": list})
}
