package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"medlog/internal/auth"
	"medlog/internal/db"
	"medlog/internal/handlers"
	"medlog/internal/models"
)

// meUpdateFixture cria um usuário com senha conhecida e devolve o handler já
// embrulhado na sessão daquele usuário, do jeito que as outras suítes fazem.
func meUpdateFixture(t *testing.T) (*handlers.UserHandler, string, func(body any) *httptest.ResponseRecorder) {
	t.Helper()
	database := db.SetupTestDB(t)
	auth.InitSessions(database, false)
	userH := &handlers.UserHandler{DB: database}

	hash, _ := bcrypt.GenerateFromPassword([]byte("senha-atual"), bcrypt.MinCost)
	userID := uuid.New().String()
	if _, err := models.UserCreate(context.Background(), database, userID, models.CreateUserInput{
		Email: "dono@test.com", Name: "Dono", PasswordHash: string(hash), Role: "USER", Theme: "SYSTEM",
	}); err != nil {
		t.Fatalf("criar usuário: %v", err)
	}

	patch := func(body any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		r := httptest.NewRequest(http.MethodPatch, "/api/users/me", bytes.NewReader(raw))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		withSession := func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				auth.Manager.Put(r.Context(), auth.SessionKeyUserID, userID)
				auth.Manager.Put(r.Context(), auth.SessionKeyRole, "USER")
				next.ServeHTTP(w, r)
			})
		}
		wrapWithSession(withSession(http.HandlerFunc(userH.MeUpdate))).ServeHTTP(w, r)
		return w
	}
	return userH, userID, patch
}

// O formulário de Configurações manda o e-mail em toda gravação. Enviar o
// mesmo e-mail não é trocar credencial, então não pode exigir senha: era esse
// o defeito que travava salvar sexo biológico e nascimento pela interface.
func TestMeUpdate_SameEmailNeedsNoPassword(t *testing.T) {
	_, _, patch := meUpdateFixture(t)

	w := patch(map[string]any{
		"name":          "Dono",
		"email":         "dono@test.com",
		"biologicalSex": "M",
		"birthDate":     "1980-05-15",
	})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Data models.User `json:"data"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decodificar resposta: %v", err)
	}
	if resp.Data.BiologicalSex == nil || *resp.Data.BiologicalSex != "M" {
		t.Errorf("biologicalSex = %v, want M", resp.Data.BiologicalSex)
	}
	// A coluna é DATE: sem date() no SELECT o driver devolve time.Time, que
	// serializa em RFC3339 e um <input type="date"> recusa, deixando o campo
	// em branco na volta.
	if resp.Data.BirthDate == nil || *resp.Data.BirthDate != "1980-05-15" {
		t.Errorf("birthDate = %v, want 1980-05-15", resp.Data.BirthDate)
	}
}

// Trocar o e-mail de fato continua exigindo a senha atual (ADR 0014).
func TestMeUpdate_EmailChangeRequiresPassword(t *testing.T) {
	_, _, patch := meUpdateFixture(t)

	if w := patch(map[string]any{"email": "outro@test.com"}); w.Code != http.StatusBadRequest {
		t.Errorf("sem senha: status = %d, want 400; body: %s", w.Code, w.Body.String())
	}
	if w := patch(map[string]any{"email": "outro@test.com", "currentPassword": "errada"}); w.Code != http.StatusUnauthorized {
		t.Errorf("senha errada: status = %d, want 401; body: %s", w.Code, w.Body.String())
	}
	w := patch(map[string]any{"email": "outro@test.com", "currentPassword": "senha-atual"})
	if w.Code != http.StatusOK {
		t.Fatalf("senha certa: status = %d, want 200; body: %s", w.Code, w.Body.String())
	}
}

// Data de nascimento segue validada: formato, futuro e implausível.
func TestMeUpdate_BirthDateValidation(t *testing.T) {
	_, _, patch := meUpdateFixture(t)

	for _, bad := range []string{"15/05/1980", "2999-01-01", "1800-01-01"} {
		if w := patch(map[string]any{"birthDate": bad}); w.Code != http.StatusBadRequest {
			t.Errorf("birthDate %q: status = %d, want 400; body: %s", bad, w.Code, w.Body.String())
		}
	}
}
