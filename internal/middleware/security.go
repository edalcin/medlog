package middleware

import "net/http"

func Security(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// SAMEORIGIN, not DENY: the extraction review shows the report PDF
		// beside the extracted values, and the PDF is served from this very
		// origin. Third-party framing stays blocked, which is what DENY
		// actually protected against; frame-ancestors is the modern spelling
		// of the same rule.
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob:; connect-src 'self'; "+
				"frame-src 'self'; object-src 'self'; frame-ancestors 'self'")
		next.ServeHTTP(w, r)
	})
}
