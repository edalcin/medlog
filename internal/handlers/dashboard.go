package handlers

import (
	"database/sql"
	"math"
	"net/http"

	"medlog/internal/auth"
)

type DashboardHandler struct {
	DB *sql.DB
}

type DashboardStats struct {
	Summary struct {
		TotalConsultations int `json:"totalConsultations"`
		TotalEpisodes      int `json:"totalEpisodes"`
		TotalProfessionals int `json:"totalProfessionals"`
		TotalFiles         int `json:"totalFiles"`
	} `json:"summary"`
	BySpecialty         []nameCount          `json:"bySpecialty"`
	ByClinic            []nameCount          `json:"byClinic"`
	ByYear              []yearCount          `json:"byYear"`
	ByProfessional      []profCount          `json:"byProfessional"`
	ByMonth             []monthCount         `json:"byMonth"`
	RecentConsultations []recentConsultation `json:"recentConsultations"`
	RecentEpisodes      []recentEpisode      `json:"recentEpisodes"`
	TopRated            []topRated           `json:"topRatedProfessionals"`
}

type nameCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type yearCount struct {
	Year  string `json:"year"`
	Count int    `json:"count"`
}

type monthCount struct {
	Month string `json:"month"`
	Count int    `json:"count"`
}

type profCount struct {
	Name      string `json:"name"`
	Specialty string `json:"specialty"`
	Count     int    `json:"count"`
}

type recentConsultation struct {
	ID               string `json:"id"`
	Date             string `json:"date"`
	ProfessionalName string `json:"professionalName"`
	Specialty        string `json:"specialty"`
}

type recentEpisode struct {
	ID    string `json:"id"`
	Date  string `json:"date"`
	Title string `json:"title"`
}

type topRated struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Specialty     string  `json:"specialty"`
	AverageRating float64 `json:"averageRating"`
	TotalRatings  int     `json:"totalRatings"`
}

func (h *DashboardHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := auth.Manager.GetString(r.Context(), auth.SessionKeyUserID)
	role := auth.Manager.GetString(r.Context(), auth.SessionKeyRole)
	isAdmin := role == "ADMIN"

	var stats DashboardStats
	ctx := r.Context()

	userFilter := "AND c.user_id = ?"
	userArg := []any{userID}
	if isAdmin {
		userFilter = ""
		userArg = nil
	}

	// --- Summary ---
	q := "SELECT COUNT(*) FROM consultations c WHERE c.type = 'CONSULTATION' " + userFilter
	if err := h.DB.QueryRowContext(ctx, q, userArg...).Scan(&stats.Summary.TotalConsultations); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}

	q = "SELECT COUNT(*) FROM consultations c WHERE c.type != 'CONSULTATION' " + userFilter
	if err := h.DB.QueryRowContext(ctx, q, userArg...).Scan(&stats.Summary.TotalEpisodes); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}

	q = "SELECT COUNT(DISTINCT c.professional_id) FROM consultations c WHERE c.professional_id IS NOT NULL " + userFilter
	if err := h.DB.QueryRowContext(ctx, q, userArg...).Scan(&stats.Summary.TotalProfessionals); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}

	fileFilter := "WHERE f.user_id = ?"
	fileArg := []any{userID}
	if isAdmin {
		fileFilter = ""
		fileArg = nil
	}
	if err := h.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM files f "+fileFilter, fileArg...).Scan(&stats.Summary.TotalFiles); err != nil {
		writeError(w, "db error", http.StatusInternalServerError)
		return
	}

	// --- By Specialty ---
	q = `SELECT s.name, COUNT(c.id) as cnt
	     FROM consultations c
	     JOIN professionals p ON p.id = c.professional_id
	     JOIN professional_specialties ps ON ps.professional_id = p.id
	     JOIN specialties s ON s.id = ps.specialty_id
	     WHERE 1=1 ` + userFilter + `
	     GROUP BY s.id, s.name ORDER BY cnt DESC LIMIT 10`
	rows, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var nc nameCount
			if rows.Scan(&nc.Name, &nc.Count) == nil {
				stats.BySpecialty = append(stats.BySpecialty, nc)
			}
		}
	}
	if stats.BySpecialty == nil {
		stats.BySpecialty = []nameCount{}
	}

	// --- By Clinic ---
	q = `SELECT cl.name, COUNT(c.id) as cnt
	     FROM consultations c
	     JOIN professionals p ON p.id = c.professional_id
	     JOIN clinics cl ON cl.id = p.clinic_id
	     WHERE c.professional_id IS NOT NULL AND p.clinic_id IS NOT NULL ` + userFilter + `
	     GROUP BY cl.id, cl.name ORDER BY cnt DESC LIMIT 10`
	rows2, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var nc nameCount
			if rows2.Scan(&nc.Name, &nc.Count) == nil {
				stats.ByClinic = append(stats.ByClinic, nc)
			}
		}
	}
	if stats.ByClinic == nil {
		stats.ByClinic = []nameCount{}
	}

	// --- By Year ---
	q = `SELECT strftime('%Y', c.date) as yr, COUNT(*) as cnt
	     FROM consultations c WHERE 1=1 ` + userFilter + `
	     GROUP BY yr ORDER BY yr DESC`
	rows3, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var yc yearCount
			if rows3.Scan(&yc.Year, &yc.Count) == nil {
				stats.ByYear = append(stats.ByYear, yc)
			}
		}
	}
	if stats.ByYear == nil {
		stats.ByYear = []yearCount{}
	}

	// --- By Professional (top 10) ---
	q = `SELECT p.name,
	       COALESCE((SELECT s.name FROM professional_specialties ps2
	                 JOIN specialties s ON s.id = ps2.specialty_id
	                 WHERE ps2.professional_id = p.id ORDER BY s.name LIMIT 1), '') as specialty,
	       COUNT(c.id) as cnt
	     FROM consultations c
	     JOIN professionals p ON p.id = c.professional_id
	     WHERE c.professional_id IS NOT NULL ` + userFilter + `
	     GROUP BY c.professional_id, p.name ORDER BY cnt DESC LIMIT 10`
	rows4, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var pc profCount
			if rows4.Scan(&pc.Name, &pc.Specialty, &pc.Count) == nil {
				stats.ByProfessional = append(stats.ByProfessional, pc)
			}
		}
	}
	if stats.ByProfessional == nil {
		stats.ByProfessional = []profCount{}
	}

	// --- By Month (last 12 months) ---
	q = `SELECT strftime('%Y-%m', c.date) as mo, COUNT(*) as cnt
	     FROM consultations c
	     WHERE c.date >= date('now', '-12 months') ` + userFilter + `
	     GROUP BY mo ORDER BY mo ASC`
	rows5, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows5.Close()
		for rows5.Next() {
			var mc monthCount
			if rows5.Scan(&mc.Month, &mc.Count) == nil {
				stats.ByMonth = append(stats.ByMonth, mc)
			}
		}
	}
	if stats.ByMonth == nil {
		stats.ByMonth = []monthCount{}
	}

	// --- Recent Consultations ---
	q = `SELECT c.id, c.date,
	       COALESCE(p.name, '-') as prof_name,
	       COALESCE((SELECT s.name FROM professional_specialties ps2
	                 JOIN specialties s ON s.id = ps2.specialty_id
	                 WHERE ps2.professional_id = p.id ORDER BY s.name LIMIT 1), '-') as specialty
	     FROM consultations c
	     LEFT JOIN professionals p ON p.id = c.professional_id
	     WHERE c.type = 'CONSULTATION' ` + userFilter + `
	     ORDER BY c.date DESC LIMIT 5`
	rows6, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows6.Close()
		for rows6.Next() {
			var rc recentConsultation
			if rows6.Scan(&rc.ID, &rc.Date, &rc.ProfessionalName, &rc.Specialty) == nil {
				stats.RecentConsultations = append(stats.RecentConsultations, rc)
			}
		}
	}
	if stats.RecentConsultations == nil {
		stats.RecentConsultations = []recentConsultation{}
	}

	// --- Recent Episodes ---
	q = `SELECT c.id, c.date, COALESCE(c.proposito, 'Sem título') as title
	     FROM consultations c WHERE c.type != 'CONSULTATION' ` + userFilter + `
	     ORDER BY c.date DESC LIMIT 5`
	rows7, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows7.Close()
		for rows7.Next() {
			var re recentEpisode
			if rows7.Scan(&re.ID, &re.Date, &re.Title) == nil {
				stats.RecentEpisodes = append(stats.RecentEpisodes, re)
			}
		}
	}
	if stats.RecentEpisodes == nil {
		stats.RecentEpisodes = []recentEpisode{}
	}

	// --- Top Rated Professionals ---
	q = `SELECT p.id, p.name,
	       COALESCE((SELECT s.name FROM professional_specialties ps2
	                 JOIN specialties s ON s.id = ps2.specialty_id
	                 WHERE ps2.professional_id = p.id ORDER BY s.name LIMIT 1), '') as specialty,
	       AVG(CAST(c.rating AS REAL)) as avg_rating,
	       COUNT(c.rating) as total_ratings
	     FROM consultations c
	     JOIN professionals p ON p.id = c.professional_id
	     WHERE c.type = 'CONSULTATION' AND c.rating IS NOT NULL AND c.professional_id IS NOT NULL ` + userFilter + `
	     GROUP BY c.professional_id, p.id, p.name
	     HAVING total_ratings > 0
	     ORDER BY avg_rating DESC LIMIT 5`
	rows8, err := h.DB.QueryContext(ctx, q, userArg...)
	if err == nil {
		defer rows8.Close()
		for rows8.Next() {
			var tr topRated
			if rows8.Scan(&tr.ID, &tr.Name, &tr.Specialty, &tr.AverageRating, &tr.TotalRatings) == nil {
				tr.AverageRating = math.Round(tr.AverageRating*10) / 10
				stats.TopRated = append(stats.TopRated, tr)
			}
		}
	}
	if stats.TopRated == nil {
		stats.TopRated = []topRated{}
	}

	writeJSON(w, http.StatusOK, stats)
}
