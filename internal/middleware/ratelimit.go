package middleware

import (
	"database/sql"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	rateLimitMax    = 5
	rateLimitWindow = time.Minute
)

// RateLimit returns a chi-compatible middleware that limits requests to
// rateLimitMax per IP per rateLimitWindow. Intended for use on POST /auth/signin.
//
// IP detection order: CF-Connecting-IP → X-Forwarded-For (when trustProxy) → RemoteAddr.
func RateLimit(db *sql.DB, trustProxy bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := extractIP(r, trustProxy)
			window := time.Now().UTC().Truncate(rateLimitWindow)

			// Clean up windows older than 2 minutes to keep the table small.
			if _, err := db.ExecContext(r.Context(),
				"DELETE FROM rate_limit_attempts WHERE window_start < datetime('now', '-2 minutes')"); err != nil {
				slog.Error("ratelimit: cleanup", "err", err)
			}

			// Upsert attempt counter.
			if _, err := db.ExecContext(r.Context(),
				`INSERT INTO rate_limit_attempts (ip, window_start, attempts) VALUES (?, ?, 1)
				 ON CONFLICT(ip, window_start) DO UPDATE SET attempts = attempts + 1`,
				ip, window); err != nil {
				slog.Error("ratelimit: upsert", "err", err)
				next.ServeHTTP(w, r)
				return
			}

			// Read current count.
			var attempts int
			if err := db.QueryRowContext(r.Context(),
				"SELECT attempts FROM rate_limit_attempts WHERE ip=? AND window_start=?",
				ip, window).Scan(&attempts); err != nil {
				slog.Error("ratelimit: read attempts", "err", err)
				next.ServeHTTP(w, r)
				return
			}

			if attempts > rateLimitMax {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"too many requests"}`, http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func extractIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
			return strings.TrimSpace(ip)
		}
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			// Leftmost entry is the original client.
			if idx := strings.Index(fwd, ","); idx >= 0 {
				return strings.TrimSpace(fwd[:idx])
			}
			return strings.TrimSpace(fwd)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
