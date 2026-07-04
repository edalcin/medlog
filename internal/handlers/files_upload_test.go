package handlers_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"medlog/internal/auth"
	appdb "medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

// uploadFileHandler builds the real POST /api/files route (auth middleware +
// session middleware), mirroring how cmd/medlog/main.go wires
// handlers.FileHandler.Upload, so the multipart parsing and hash/dedup logic
// inside the handler run exactly as they do in production.
func uploadFileHandler(fileH *handlers.FileHandler) http.Handler {
	router := chi.NewRouter()
	router.With(auth.RequireAuth).Post("/api/files", fileH.Upload)
	return wrapWithSession(router)
}

// buildUploadRequest builds a real multipart/form-data POST body with a
// "file" part carrying content under mimeType (must be one of
// allowedMIMETypes) plus any extra form fields (e.g. "categoryIds", which
// may repeat).
func buildUploadRequest(t *testing.T, cookie *http.Cookie, content []byte, mimeType string, fields map[string][]string) *http.Request {
	t.Helper()
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)

	// multipart.Writer.CreateFormFile hardcodes Content-Type to
	// application/octet-stream; the handler keys off the part's declared
	// Content-Type, so build the part manually to set a real allowed MIME type.
	part, err := mw.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="file"; filename="upload.bin"`},
		"Content-Type":        {mimeType},
	})
	if err != nil {
		t.Fatalf("create file part: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write file content: %v", err)
	}
	for key, values := range fields {
		for _, v := range values {
			if err := mw.WriteField(key, v); err != nil {
				t.Fatalf("write field %s: %v", key, err)
			}
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	r := httptest.NewRequest(http.MethodPost, "/api/files", body)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	r.AddCookie(cookie)
	return r
}

// uploadFile POSTs content through the real Upload handler and decodes the
// JSON response body ("data" on 2xx; "error"/"existingFile" on 409).
func uploadFile(t *testing.T, fileH *handlers.FileHandler, cookie *http.Cookie, content []byte, mimeType string, fields map[string][]string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	r := buildUploadRequest(t, cookie, content, mimeType, fields)
	w := httptest.NewRecorder()
	uploadFileHandler(fileH).ServeHTTP(w, r)

	var resp map[string]any
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v; body: %s", err, w.Body.String())
	}
	return w, resp
}

// TestFileUpload_FirstUploadSucceedsWithHash covers the base case of the new
// content-hash dedup: a first-time upload must succeed, store a real SHA-256
// hex hash on the created row, and write the file to disk.
func TestFileUpload_FirstUploadSucceedsWithHash(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}

	cookie := signInAndGetCookie(t, database, authH, "upload-first@test.com", "pass1234")

	content := []byte("dedup content X")
	w, resp := uploadFile(t, fileH, cookie, content, "image/png", nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	data, ok := resp["data"].(map[string]any)
	if !ok {
		t.Fatalf("response missing data object; body: %s", w.Body.String())
	}

	sum := sha256.Sum256(content)
	wantHash := hex.EncodeToString(sum[:])
	gotHash, _ := data["hash"].(string)
	if len(gotHash) != 64 {
		t.Errorf("hash = %q, want a 64-char hex string", gotHash)
	}
	if gotHash != wantHash {
		t.Errorf("hash = %q, want %q (sha256 of uploaded content)", gotHash, wantHash)
	}

	path, _ := data["path"].(string)
	if path == "" {
		t.Fatalf("response missing path; body: %s", w.Body.String())
	}
	if _, err := os.Stat(path); err != nil {
		t.Errorf("uploaded file not found on disk at %q: %v", path, err)
	}
}

// TestFileUpload_DuplicateSameUserRejected covers the dedup rejection path:
// re-uploading identical bytes as the same owner must be refused outright —
// no second DB row, no second file on disk — and the 409 body must let the
// client find its way back to the file that already exists.
func TestFileUpload_DuplicateSameUserRejected(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	cookie := signInAndGetCookie(t, database, authH, "upload-dup@test.com", "pass1234")
	u, _, err := models.UserFindByEmail(ctx, database, "upload-dup@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	content := []byte("dedup content X")
	w1, resp1 := uploadFile(t, fileH, cookie, content, "image/png", nil)
	if w1.Code != http.StatusCreated {
		t.Fatalf("first upload status = %d, want %d; body: %s", w1.Code, http.StatusCreated, w1.Body.String())
	}
	firstID, _ := resp1["data"].(map[string]any)["id"].(string)
	if firstID == "" {
		t.Fatalf("first upload missing id; body: %s", w1.Body.String())
	}

	w2, resp2 := uploadFile(t, fileH, cookie, content, "image/png", nil)
	if w2.Code != http.StatusConflict {
		t.Fatalf("second (duplicate) upload status = %d, want %d; body: %s", w2.Code, http.StatusConflict, w2.Body.String())
	}
	if errMsg, _ := resp2["error"].(string); errMsg != "duplicate file" {
		t.Errorf(`error = %q, want "duplicate file"`, errMsg)
	}
	existing, ok := resp2["existingFile"].(map[string]any)
	if !ok {
		t.Fatalf("response missing existingFile; body: %s", w2.Body.String())
	}
	if gotID, _ := existing["id"].(string); gotID != firstID {
		t.Errorf("existingFile.id = %q, want %q (the original upload)", gotID, firstID)
	}

	// No second row: exactly one file must exist for this owner. If the hash
	// check were accidentally removed, this would find 2.
	list, err := models.FileFindByOwner(ctx, database, u.ID, 10, 0, models.FileListOptions{})
	if err != nil {
		t.Fatalf("FileFindByOwner: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("file rows for owner = %d, want 1 (duplicate upload must not create a row)", len(list))
	}

	// No second file on disk either.
	entries, err := os.ReadDir(filesPath)
	if err != nil {
		t.Fatalf("ReadDir filesPath: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("files written to disk = %d, want 1 (duplicate upload must not write to disk)", len(entries))
	}
}

// TestFileUpload_DifferentContentSameUserSucceeds confirms the hash check is
// keyed on content, not just "any file already uploaded by this user" — a
// second, distinct upload must go through as a normal second file.
func TestFileUpload_DifferentContentSameUserSucceeds(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	cookie := signInAndGetCookie(t, database, authH, "upload-diff@test.com", "pass1234")
	u, _, err := models.UserFindByEmail(ctx, database, "upload-diff@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail: %v", err)
	}

	w1, resp1 := uploadFile(t, fileH, cookie, []byte("dedup content X"), "image/png", nil)
	if w1.Code != http.StatusCreated {
		t.Fatalf("first upload status = %d, want %d; body: %s", w1.Code, http.StatusCreated, w1.Body.String())
	}
	firstID, _ := resp1["data"].(map[string]any)["id"].(string)

	w2, resp2 := uploadFile(t, fileH, cookie, []byte("dedup content Y"), "image/png", nil)
	if w2.Code != http.StatusCreated {
		t.Fatalf("second (different content) upload status = %d, want %d; body: %s", w2.Code, http.StatusCreated, w2.Body.String())
	}
	secondID, _ := resp2["data"].(map[string]any)["id"].(string)

	if firstID == "" || secondID == "" {
		t.Fatalf("missing ids: first=%q second=%q", firstID, secondID)
	}
	if firstID == secondID {
		t.Errorf("second upload id = first upload id %q, want distinct ids", firstID)
	}

	list, err := models.FileFindByOwner(ctx, database, u.ID, 10, 0, models.FileListOptions{})
	if err != nil {
		t.Fatalf("FileFindByOwner: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("file rows for owner = %d, want 2", len(list))
	}
}

// TestFileUpload_SameContentDifferentUsersBothSucceed confirms dedup is
// scoped per-owner, not global: two different users uploading byte-identical
// content must each get their own file row. If FileFindByHash were ever
// called without the ownerUserID scope, user B's upload here would come back
// 409 instead of 201.
func TestFileUpload_SameContentDifferentUsersBothSucceed(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	cookieA := signInAndGetCookie(t, database, authH, "upload-cross-a@test.com", "pass1234")
	userA, _, err := models.UserFindByEmail(ctx, database, "upload-cross-a@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail A: %v", err)
	}
	cookieB := signInAndGetCookie(t, database, authH, "upload-cross-b@test.com", "pass1234")
	userB, _, err := models.UserFindByEmail(ctx, database, "upload-cross-b@test.com")
	if err != nil {
		t.Fatalf("UserFindByEmail B: %v", err)
	}

	content := []byte("dedup content shared across owners")
	wA, respA := uploadFile(t, fileH, cookieA, content, "image/png", nil)
	if wA.Code != http.StatusCreated {
		t.Fatalf("user A upload status = %d, want %d; body: %s", wA.Code, http.StatusCreated, wA.Body.String())
	}
	wB, respB := uploadFile(t, fileH, cookieB, content, "image/png", nil)
	if wB.Code != http.StatusCreated {
		t.Fatalf("user B upload status = %d, want %d (dedup must be per-owner, not global); body: %s", wB.Code, http.StatusCreated, wB.Body.String())
	}

	dataA, _ := respA["data"].(map[string]any)
	dataB, _ := respB["data"].(map[string]any)
	idA, _ := dataA["id"].(string)
	idB, _ := dataB["id"].(string)
	if idA == "" || idB == "" || idA == idB {
		t.Fatalf("expected distinct file ids for each owner, got A=%q B=%q", idA, idB)
	}

	sum := sha256.Sum256(content)
	wantHash := hex.EncodeToString(sum[:])
	if hashA, _ := dataA["hash"].(string); hashA != wantHash {
		t.Errorf("user A hash = %q, want %q", hashA, wantHash)
	}
	if hashB, _ := dataB["hash"].(string); hashB != wantHash {
		t.Errorf("user B hash = %q, want %q", hashB, wantHash)
	}

	listA, err := models.FileFindByOwner(ctx, database, userA.ID, 10, 0, models.FileListOptions{})
	if err != nil {
		t.Fatalf("FileFindByOwner A: %v", err)
	}
	if len(listA) != 1 {
		t.Errorf("owner A file rows = %d, want 1", len(listA))
	}
	listB, err := models.FileFindByOwner(ctx, database, userB.ID, 10, 0, models.FileListOptions{})
	if err != nil {
		t.Fatalf("FileFindByOwner B: %v", err)
	}
	if len(listB) != 1 {
		t.Errorf("owner B file rows = %d, want 1", len(listB))
	}
}

// TestFileUpload_DuplicateRejectionIncludesCategories confirms the 409 body
// carries the existing file's categories — required so a client can
// re-associate the file (e.g. attach it to a consultation) without wiping
// its categories, per the UpdateFileInput nil-means-clear contract.
func TestFileUpload_DuplicateRejectionIncludesCategories(t *testing.T) {
	database := appdb.SetupTestDB(t)
	auth.InitSessions(database, false)
	authH := &handlers.AuthHandler{DB: database}
	filesPath := t.TempDir()
	fileH := &handlers.FileHandler{DB: database, FilesPath: filesPath}
	ctx := context.Background()

	cookie := signInAndGetCookie(t, database, authH, "upload-cats@test.com", "pass1234")

	cat, err := models.CategoryCreate(ctx, database, uuid.New().String(), "Lab Results")
	if err != nil {
		t.Fatalf("CategoryCreate: %v", err)
	}

	content := []byte("dedup content with categories")
	w1, resp1 := uploadFile(t, fileH, cookie, content, "image/png", map[string][]string{"categoryIds": {cat.ID}})
	if w1.Code != http.StatusCreated {
		t.Fatalf("first upload status = %d, want %d; body: %s", w1.Code, http.StatusCreated, w1.Body.String())
	}
	firstData, _ := resp1["data"].(map[string]any)
	firstCats, _ := firstData["categories"].([]any)
	if len(firstCats) != 1 {
		t.Fatalf("first upload categories = %v, want 1 entry", firstData["categories"])
	}

	w2, resp2 := uploadFile(t, fileH, cookie, content, "image/png", nil)
	if w2.Code != http.StatusConflict {
		t.Fatalf("duplicate upload status = %d, want %d; body: %s", w2.Code, http.StatusConflict, w2.Body.String())
	}
	existing, ok := resp2["existingFile"].(map[string]any)
	if !ok {
		t.Fatalf("response missing existingFile; body: %s", w2.Body.String())
	}
	cats, ok := existing["categories"].([]any)
	if !ok || len(cats) == 0 {
		t.Fatalf("existingFile.categories = %v, want non-empty (client needs this to re-associate without wiping categories)", existing["categories"])
	}
	entry, ok := cats[0].(map[string]any)
	if !ok {
		t.Fatalf("existingFile.categories[0] not an object: %v", cats[0])
	}
	if gotID, _ := entry["id"].(string); gotID != cat.ID {
		t.Errorf("existingFile.categories[0].id = %q, want %q", gotID, cat.ID)
	}
}
