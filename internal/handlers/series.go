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

// Series returns one indicator's confirmed observations, oldest first, plus
// the Faixa de normalidade resolved for whoever is signed in. The
// non-numeric observations travel too: the screen lists them instead of
// plotting them.
//
// Both travel in one response on purpose: the screen cannot draw the band
// without the range, and a second round trip would only add a flicker.
func (h *SeriesHandler) Series(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	code := chi.URLParam(r, "code")
	list, err := models.ObservationFindSeries(r.Context(), h.DB, userID, code)
	if err != nil {
		writeDBError(w, err)
		return
	}
	u, err := models.UserFindByID(r.Context(), h.DB, userID)
	if err != nil {
		writeDBError(w, err)
		return
	}
	normal, err := models.NormalRangeResolve(r.Context(), h.DB, code, u.BiologicalSex, u.BirthDate)
	if err != nil {
		writeDBError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": map[string]any{
		"observations": list,
		"normalRange":  normal,
	}})
}
