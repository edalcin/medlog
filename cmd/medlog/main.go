package main

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/auth"
	"medlog/internal/db"
	embedfs "medlog/internal/embed"
	"medlog/internal/handlers"
	appmiddleware "medlog/internal/middleware"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		port := envOrDefault("PORT", "3000")
		resp, err := http.Get("http://localhost:" + port + "/health")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	databaseURL := mustEnv("DATABASE_URL")
	sessionSecret := mustEnv("SESSION_SECRET")
	filesPath := envOrDefault("FILES_PATH", "./uploads")
	port := envOrDefault("PORT", "3000")
	sessionSecure := os.Getenv("SESSION_SECURE") == "true"
	trustProxy := os.Getenv("TRUST_PROXY") == "true"
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPassword := os.Getenv("ADMIN_PASSWORD")

	if err := os.MkdirAll(filesPath, 0755); err != nil {
		log.Fatalf("create uploads dir: %v", err)
	}

	database, err := db.Open(databaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	if err := db.Migrate(database); err != nil {
		log.Fatalf("run migrations: %v", err)
	}

	if err := bootstrapAdmin(database, adminEmail, adminPassword); err != nil {
		log.Fatalf("bootstrap admin: %v", err)
	}

	if err := auth.EnsureSessionSecret(database, sessionSecret); err != nil {
		log.Fatalf("session secret check: %v", err)
	}

	auth.InitSessions(database, sessionSecure)

	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(appmiddleware.Security)
	r.Use(auth.Manager.LoadAndSave)

	healthHandler := &handlers.HealthHandler{DB: database}
	r.Get("/health", healthHandler.Health)

	r.Route("/api", func(r chi.Router) {
		registerRoutes(r, database, filesPath, databaseURL, trustProxy)
	})

	r.Handle("/*", spaHandler())

	addr := ":" + port
	log.Printf("MedLog v2 starting on %s", addr)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func registerRoutes(r chi.Router, database *sql.DB, filesPath, databaseURL string, trustProxy bool) {
	authH := &handlers.AuthHandler{DB: database}
	r.With(appmiddleware.RateLimit(database, trustProxy)).Post("/auth/signin", authH.SignIn)
	r.Post("/auth/signout", authH.SignOut)

	specialtyH := &handlers.SpecialtyHandler{DB: database}
	categoryH := &handlers.CategoryHandler{DB: database}
	clinicH := &handlers.ClinicHandler{DB: database}
	profH := &handlers.ProfessionalHandler{DB: database, FilesPath: filesPath}
	consultH := &handlers.ConsultationHandler{DB: database, FilesPath: filesPath}
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	phoneH := &handlers.PhoneHandler{DB: database}
	sharingH := &handlers.SharingHandler{DB: database}
	userH := &handlers.UserHandler{DB: database}
	adminH := &handlers.AdminHandler{DB: database, FilesPath: filesPath, DBPath: extractDBPath(databaseURL)}
	dashH := &handlers.DashboardHandler{DB: database}

	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAuth)

		r.Get("/auth/me", authH.Me)
		r.Get("/users/others", userH.ListOthers)
		r.Put("/users/me/password", userH.MeUpdatePassword)
		r.Patch("/users/me/theme", userH.MeUpdateTheme)
		r.Get("/dashboard", dashH.Get)

		r.Get("/specialties", specialtyH.List)
		r.Get("/file-categories", categoryH.List)

		r.Get("/clinics", clinicH.List)
		r.Post("/clinics", clinicH.Create)
		r.Put("/clinics/{id}", clinicH.Update)
		r.Delete("/clinics/{id}", clinicH.Delete)

		r.Get("/professionals", profH.List)
		r.Post("/professionals", profH.Create)
		r.Get("/professionals/{id}", profH.Get)
		r.Put("/professionals/{id}", profH.Update)
		r.Delete("/professionals/{id}", profH.Delete)

		r.Get("/consultations", consultH.List)
		r.Post("/consultations", consultH.Create)
		r.Get("/consultations/{id}", consultH.Get)
		r.Put("/consultations/{id}", consultH.Update)
		r.Delete("/consultations/{id}", consultH.Delete)

		r.Post("/files", fileH.Upload)
		r.Get("/files/{filename}", fileH.Serve)
		r.Delete("/files/{id}", fileH.Delete)

		r.Get("/professionals/{id}/phones", phoneH.ListByProfessional)
		r.Post("/professionals/{id}/phones", phoneH.CreateForProfessional)
		r.Get("/clinics/{id}/phones", phoneH.ListByClinic)
		r.Post("/clinics/{id}/phones", phoneH.CreateForClinic)
		r.Put("/phones/{id}", phoneH.Update)
		r.Delete("/phones/{id}", phoneH.Delete)

		r.Get("/sharing/professionals", sharingH.ListProfessionalSharing)
		r.Post("/sharing/professionals", sharingH.CreateProfessionalSharing)
		r.Delete("/sharing/professionals/{userId}", sharingH.DeleteProfessionalSharing)
		r.Get("/sharing/clinics", sharingH.ListClinicSharing)
		r.Post("/sharing/clinics", sharingH.CreateClinicSharing)
		r.Delete("/sharing/clinics/{userId}", sharingH.DeleteClinicSharing)
	})

	r.Group(func(r chi.Router) {
		r.Use(auth.RequireAdmin)

		r.Post("/specialties", specialtyH.Create)
		r.Put("/specialties/{id}", specialtyH.Update)
		r.Delete("/specialties/{id}", specialtyH.Delete)

		r.Post("/file-categories", categoryH.Create)
		r.Put("/file-categories/{id}", categoryH.Update)
		r.Delete("/file-categories/{id}", categoryH.Delete)

		r.Get("/users", userH.List)
		r.Post("/users", userH.Create)
		r.Get("/users/{id}", userH.Get)
		r.Put("/users/{id}", userH.Update)
		r.Put("/users/{id}/password", userH.UpdatePassword)
		r.Delete("/users/{id}", userH.Delete)

		r.Get("/admin/stats", adminH.Stats)
		r.Get("/admin/consultations", adminH.ListConsultations)
		r.Post("/admin/consultations/bulk-delete", adminH.BulkDeleteConsultations)
		r.Get("/admin/professionals", adminH.ListProfessionals)
		r.Post("/admin/professionals/bulk-delete", adminH.BulkDeleteProfessionals)
		r.Get("/admin/files", adminH.ListFiles)
		r.Get("/admin/login-logs", adminH.ListLoginLogs)
		r.Get("/admin/backup", adminH.Backup)
		r.Post("/admin/restore", adminH.Restore)
	})
}

func bootstrapAdmin(database *sql.DB, email, password string) error {
	var count int
	if err := database.QueryRowContext(context.Background(),
		"SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil
	}
	if email == "" || password == "" {
		return fmt.Errorf("no users exist: set ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the first admin")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	now := time.Now().UTC()
	_, err = database.ExecContext(context.Background(),
		`INSERT INTO users (id, email, name, password_hash, role, theme, created_at, updated_at)
		 VALUES (?, ?, 'Admin', ?, 'ADMIN', 'SYSTEM', ?, ?)`,
		uuid.New().String(), email, string(hash), now, now,
	)
	if err != nil {
		return fmt.Errorf("insert admin: %w", err)
	}
	log.Printf("Admin user created: %s", email)
	return nil
}

func spaHandler() http.Handler {
	distFS, err := fs.Sub(embedfs.StaticFiles, "dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			fmt.Fprint(w, `<!DOCTYPE html><html><body><h1>MedLog v2</h1><p>Frontend not built: cd frontend && npm run build</p></body></html>`)
		})
	}
	fileServer := http.FileServer(http.FS(distFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if _, err := distFS.Open(path); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// extractDBPath converts a SQLite DATABASE_URL to a plain file path.
// "file:/path/to/db.sqlite" → "/path/to/db.sqlite"
// "file:./data/medlog.sqlite?cache=shared" → "./data/medlog.sqlite"
func extractDBPath(databaseURL string) string {
	s := strings.TrimPrefix(databaseURL, "file:")
	if idx := strings.Index(s, "?"); idx >= 0 {
		s = s[:idx]
	}
	return s
}
