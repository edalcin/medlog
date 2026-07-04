package handlers_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	appdb "medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

// deleteFileHandler builds the real DELETE /api/files/{id} route (auth
// middleware + chi URL params + session middleware), mirroring how
// cmd/medlog/main.go wires handlers.FileHandler.Delete, so chi.URLParam
// inside the handler resolves exactly as it does in production.
func deleteFileHandler(fileH *handlers.FileHandler) http.Handler {
	router := chi.NewRouter()
	router.With(auth.RequireAuth).Delete("/api/files/{id}", fileH.Delete)
	return wrapWithSession(router)
}

// seedFile writes a real file to disk under filesPath and creates the
// matching DB row, returning the created models.File (whose Path field
// points at the file written to disk).
func seedFile(t *testing.T, ctx context.Context, database *sql.DB, filesPath, userID string, consultationID *string) *models.File {
	t.Helper()
	id := uuid.New().String()
	path := filepath.Join(filesPath, id+".txt")
	if err := os.WriteFile(path, []byte("test content"), 0o600); err != nil {
		t.Fatalf("seed file write: %v", err)
	}
	f, err := models.FileCreate(ctx, database, models.CreateFileInput{
		ID:             id,
		Filename:       id + ".txt",
		Path:           path,
		MimeType:       "text/plain",
		Size:           12,
		ConsultationID: consultationID,
		UserID:         &userID,
	})
	if err != nil {
		t.Fatalf("FileCreate: %v", err)
	}
	return f
}

func deleteFile(t *testing.T, fileH *handlers.FileHandler, cookie *http.Cookie, fileID string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	r := httptest.NewRequest(http.MethodDelete, "/api/files/"+fileID, nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()
	deleteFileHandler(fileH).ServeHTTP(w, r)

	var resp map[string]any
	if w.Code == http.StatusOK {
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("decode response: %v; body: %s", err, w.Body.String())
		}
	}
	return w, resp
}

// TestFileDelete_DisassociatesWhenLinkedToConsultation covers the new
// behavior: a file attached to a consultation must never be hard-deleted by
// DELETE /api/files/{id} — only unlinked (consultation_id cleared), keeping
// both the DB row and the file on disk intact.
func TestFileDelete_DisassociatesWhenLinkedToConsultation(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	cookie := signInAndGetCookie(t, database, authH, "filedel-disassoc@test.com", "pass1234")
	u, _, err := models.UserFindByEmail(ctx, database, "filedel-disassoc@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	consult, err := models.ConsultationCreate(ctx, database, uuid.New().String(), models.CreateConsultationInput{
		Date:   time.Now().UTC(),
		Type:   "CONSULTATION",
		UserID: u.ID,
	})
	if err != nil {
		t.Fatalf("ConsultationCreate: %v", err)
	}

	f := seedFile(t, ctx, database, filesPath, u.ID, &consult.ID)

	w, resp := deleteFile(t, fileH, cookie, f.ID)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}
	if disassociated, _ := resp["disassociated"].(bool); !disassociated {
		t.Errorf("response disassociated = %v, want true (body: %s)", resp["disassociated"], w.Body.String())
	}

	got, err := models.FileFindByID(ctx, database, f.ID)
	if err != nil {
		t.Fatalf("FileFindByID after delete: %v (row must survive a disassociate)", err)
	}
	if got.ConsultationID != nil {
		t.Errorf("consultationId = %q, want nil after disassociate", *got.ConsultationID)
	}

	if _, err := os.Stat(f.Path); err != nil {
		t.Errorf("disk file removed, want it left intact: %v", err)
	}
}

// TestFileDelete_HardDeletesWhenNoConsultationLink covers the unchanged
// branch: a file with no consultation link is still hard-deleted from both
// the DB and disk.
func TestFileDelete_HardDeletesWhenNoConsultationLink(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	cookie := signInAndGetCookie(t, database, authH, "filedel-harddelete@test.com", "pass1234")
	u, _, err := models.UserFindByEmail(ctx, database, "filedel-harddelete@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	f := seedFile(t, ctx, database, filesPath, u.ID, nil)

	w, resp := deleteFile(t, fileH, cookie, f.ID)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}
	if disassociated, _ := resp["disassociated"].(bool); disassociated {
		t.Errorf("response disassociated = %v, want false (body: %s)", resp["disassociated"], w.Body.String())
	}

	if _, err := models.FileFindByID(ctx, database, f.ID); !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("FileFindByID after delete: err = %v, want sql.ErrNoRows", err)
	}

	if _, err := os.Stat(f.Path); !os.IsNotExist(err) {
		t.Errorf("disk file stat err = %v, want IsNotExist (file should be removed)", err)
	}
}

// TestFileDelete_NonOwnerGetsNotFound confirms the ownership check ahead of
// the disassociate/delete branch is unaffected by the fix: a non-owner,
// non-admin user still gets 404, and the file is left completely untouched.
func TestFileDelete_NonOwnerGetsNotFound(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	signInAndGetCookie(t, database, authH, "filedel-owner@test.com", "pass1234")
	owner, _, err := models.UserFindByEmail(ctx, database, "filedel-owner@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}
	f := seedFile(t, ctx, database, filesPath, owner.ID, nil)

	attackerCookie := signInAndGetCookie(t, database, authH, "filedel-attacker@test.com", "pass1234")

	r := httptest.NewRequest(http.MethodDelete, "/api/files/"+f.ID, nil)
	r.AddCookie(attackerCookie)
	w := httptest.NewRecorder()
	deleteFileHandler(fileH).ServeHTTP(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusNotFound, w.Body.String())
	}

	if _, err := models.FileFindByID(ctx, database, f.ID); err != nil {
		t.Errorf("FileFindByID after rejected delete: %v, want file untouched", err)
	}
	if _, err := os.Stat(f.Path); err != nil {
		t.Errorf("disk file removed despite rejected delete: %v", err)
	}
}
