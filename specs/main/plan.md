# Implementation Plan: MedLog v2 — Code Review Full Implementation

**Branch**: `main` | **Date**: 2026-05-17 | **Spec**: specs/main/spec.md

## Summary

Implementar todos os 30 itens identificados no relatório de revisão de código (docs/CODE_REVIEW_v2.md), em ordem de prioridade. Inclui correções críticas de performance (N+1 queries), segurança (rate limiting, CSP, SESSION_SECRET), correções de bugs, novas funcionalidades (tema claro/escuro, login logs, phones, sharing), e padronização da API.

## Technical Context

**Language/Version**: Go 1.24 (backend), Svelte 5 + TypeScript (frontend)
**Primary Dependencies**: chi v5, alexedwards/scs v2, goose v3, modernc.org/sqlite, google/uuid, bcrypt; svelte-spa-router, marked (a adicionar)
**Storage**: SQLite WAL mode via modernc.org/sqlite + alexedwards/scs/sqlite3store
**Testing**: go test standard library + httptest + SQLite :memory:
**Target Platform**: Linux/Docker (Alpine), Unraid
**Project Type**: Self-hosted web application (Go SPA backend + Svelte 5 SPA)
**Performance Goals**: Reduzir 400+ queries para ~4 nas listagens; sem metas de throughput específicas
**Constraints**: Sem novas dependências externas no backend; zero downtime deploy via Docker; binary único ~30MB
**Scale/Scope**: Família/pequeno grupo (~5 usuários), <10k registros

## Constitution Check

*Constituição do projeto não foi preenchida (template placeholder). Usando princípios do CLAUDE.md global:*

| Princípio | Status |
|-----------|--------|
| Simplicidade de stack | ✅ Sem novas deps backend; `marked` é a única nova dep frontend |
| Docker pequeno | ✅ Sem impacto no tamanho do binário |
| Segurança desde o início | ✅ Rate limiting, CSP, SESSION_SECRET são foco explícito |
| Boas práticas | ✅ Single SQL statements, batch loading, structured logging |
| Sem credenciais hardcoded | ✅ `cmd/migrate-mariadb` e `cmd/sqlite-import` serão removidos |

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              ← este arquivo
├── spec.md              ← requisitos
├── research.md          ← decisões técnicas Phase 0
├── data-model.md        ← entidades e mudanças de schema
├── contracts/api.md     ← contratos de API
└── tasks.md             ← gerado por /speckit.tasks
```

### Source Code (repository root)

```text
# Backend (Go)
internal/
├── middleware/
│   ├── security.go          # + CSP header
│   └── ratelimit.go         # NOVO: rate limiting middleware
├── auth/
│   └── session.go           # + SESSION_SECRET hash rotation
├── models/
│   ├── consultation.go      # N+1 fix, single UPDATE
│   ├── professional.go      # N+1 fix, remove newID()
│   ├── file.go              # N+1 fix batch categories
│   ├── user.go              # single UPDATE, theme
│   └── phone.go             # NOVO: Phone model CRUD
├── handlers/
│   ├── auth.go              # + { data: T } wrapper, + theme in response
│   ├── consultations.go     # + { data: T } wrapper, + paginação
│   ├── professionals.go     # + { data: T } wrapper, + paginação
│   ├── admin.go             # + paginação, + login-logs, + { data: T }
│   ├── users.go             # + { data: T }, + /me/theme, + /me/password
│   ├── dashboard.go         # + { data: T } wrapper
│   ├── files.go             # + { data: T }, + Cache-Control
│   ├── clinics.go           # + { data: T }, + paginação
│   ├── specialties.go       # + { data: T }
│   ├── categories.go        # + { data: T }
│   └── phones.go            # NOVO: Phone handlers
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_rate_limiting_and_config.sql  # NOVO
│   └── 003_login_logs_extended.sql       # NOVO
cmd/
├── medlog/main.go           # + SESSION_SECRET hash check, + novas rotas
│   # REMOVER:
├── migrate-mariadb/         # DELETE
└── sqlite-import/           # DELETE (se existir)

# Config files
docker-compose.yml           # paths /app/data/
.env.example                 # paths /app/data/

# Frontend (Svelte 5)
frontend/src/
├── lib/
│   ├── api.ts               # { data: T } em todos endpoints, paginação, novas APIs
│   ├── auth.ts              # + theme no store do usuário
│   └── stores.ts            # DELETE (arquivo vazio)
├── components/
│   ├── Navigation.svelte    # + toggle de tema
│   ├── MarkdownPreview.svelte  # usar marked
│   ├── InlineCreate.svelte  # sem mudança
│   └── FileUpload.svelte    # sem mudança
├── routes/
│   ├── Reports.svelte       # fix badge: 'CONSULTA' → 'CONSULTATION'
│   ├── ConsultationNew.svelte  # + inline create profissional, + limpar form
│   ├── ConsultationList.svelte  # + paginação
│   ├── ProfessionalList.svelte  # + paginação, + campo de busca
│   ├── ProfessionalDetail.svelte  # + phones UI
│   ├── Admin.svelte         # + login-logs tab, + paginação
│   └── Dashboard.svelte     # sem mudança (response format só)
└── app.css                  # + CSS custom properties para tema claro/escuro
```

## Implementation Phases

### Fase 1 — Críticos (#1–#6) ~8h

**#1 N+1 Queries** (4h)
- `models/consultation.go`: `consultationBase()` → batch load professionals + files + categories
- `models/file.go`: `FileFindByConsultationID()` → batch load categories  
- `models/professional.go`: `ProfessionalFindAll()` e `ProfessionalFindByID()` → batch load specialties
- Criar helper `inClause(n int) string` em `models/helpers.go`

**#2 Rate Limiting** (2h)
- Migration 002: tabela `rate_limit_attempts` + `app_config`
- `internal/middleware/ratelimit.go`: middleware chi com SQLite
- `cmd/medlog/main.go`: aplicar middleware apenas em `POST /api/auth/signin`
- Cleanup: `DELETE FROM rate_limit_attempts WHERE window_start < ?` na mesma chamada

**#3 CSP Header** (15min)
- `internal/middleware/security.go`: adicionar `Content-Security-Policy` header

**#4 Docker Paths** (30min)
- `docker-compose.yml`: paths → `/app/data/`
- `.env.example`: paths → `/app/data/`

**#5 SESSION_SECRET** (1h)
- Migration 002 (já inclusa): tabela `app_config`
- `internal/auth/session.go`: função `EnsureSessionSecret(db, secret)` que verifica hash
- `cmd/medlog/main.go`: chamar antes de `InitSessions`

**#6 Remover cmd antigos** (15min)
- `rm -rf cmd/migrate-mariadb cmd/sqlite-import`
- Verificar `go.mod` — remover dep `go-sql-driver/mysql` se não mais usada

---

### Fase 2 — Alta Prioridade (#7–#15) ~18h

**#7 Padronizar { data: T }** (3h)
- Todos os handlers Go: envolver retornos singulares em `map[string]any{"data": ...}`
- `api.ts`: ajustar tipos para desempacotar `.data` em todos os endpoints
- `auth.ts`: incluir `theme` no store de usuário

**#8 Paginação** (4h)
- Helper `parsePagination(r *http.Request) (page, limit int)` em `handlers/helpers.go`
- Atualizar `consultationBase`, `ProfessionalFindAll`, etc. para aceitar `limit, offset`
- Adicionar `CountConsultations`, `CountProfessionals`, etc.
- Frontend: controles prev/next em ConsultationList, ProfessionalList, Admin

**#9 ConsultationUpdate + UserUpdate transação** (2h)
- Refatorar `ConsultationUpdate` → single dynamic UPDATE
- Refatorar `UserUpdate` → single dynamic UPDATE
- Usar `strings.Join(sets, ",")`

**#10 Logging** (2h)
- Trocar `log` standard por `log/slog` (Go 1.21+, zero deps)
- `slog.Error("db query failed", "op", "ConsultationFindAll", "err", err)`
- Adicionar logs em todos os pontos com `_` silenciados
- Logar erro real antes de `writeError(w, "db error", ...)`

**#11 Badge Reports fix** (5min)
- `Reports.svelte:91`: `'CONSULTA'` → `'CONSULTATION'`

**#12 Endpoint /users/me/password** (1h)
- Handler: verificar `currentPassword` com bcrypt, hash `newPassword`, update
- Rota: `PUT /api/users/me/password` (autenticado, não admin)
- `api.ts`: `changePassword(currentPassword, newPassword)`

**#13 Remover stores.ts** (1min)
- `rm frontend/src/lib/stores.ts`

**#14 Tema claro/escuro** (4h)
- `app.css`: CSS custom properties para dark (atual) e light themes + `data-theme` attribute
- `App.svelte`: `$effect` para aplicar `data-theme` baseado no user.theme
- `Navigation.svelte`: toggle button (sun/moon icon)
- `handlers/users.go` ou novo `handlers/me.go`: `PATCH /api/users/me/theme`
- `api.ts`: `updateTheme(theme: string)`
- `auth.ts`: incluir theme no store, atualizar ao fazer PATCH

**#15 Login Logs Admin** (2h)
- Migration 003: ADD COLUMN `ip_address`, `user_agent` em `login_logs`
- `handlers/auth.go SignIn`: capturar IP (`r.RemoteAddr`, `X-Forwarded-For`) e User-Agent
- `models/login_log.go` (novo): `LoginLogFindAll(ctx, db, limit, offset)` + count
- `handlers/admin.go`: `ListLoginLogs` handler
- Rota: `GET /api/admin/login-logs`
- `Admin.svelte`: nova aba "Logs de Acesso" com tabela paginada

---

### Fase 3 — Média Prioridade (#16–#22) ~25h

**#16 Testes de Integração** (14h)
- `internal/db/testhelper.go` (novo): `SetupTestDB(t *testing.T) *sql.DB`
- `internal/models/consultation_test.go`
- `internal/models/professional_test.go`
- `internal/handlers/auth_test.go`
- `internal/handlers/consultations_test.go`
- Usar `httptest.NewRecorder()` + `httptest.NewRequest()`

**#17 CRUD Phones** (4h)
- `models/phone.go`: PhoneFindByProfessionalID, PhoneFindByClinicID, PhoneCreate, PhoneUpdate, PhoneDelete
- `handlers/phones.go`: handlers CRUD
- Rotas: aninhadas sob professionals e clinics, + `/phones/{id}` para PUT/DELETE
- `api.ts`: getPhones, createPhone, updatePhone, deletePhone
- `ProfessionalDetail.svelte`: seção de telefones
- (Clinics: phones visíveis na UI de admin)

**#18 user_professional_sharing** (6h)
- `models/sharing.go`: SharingCreate, SharingDelete, SharingFindByUser
- `handlers/sharing.go`: handlers
- Modificar `ProfessionalFindAll` para incluir profissionais compartilhados com o usuário
- `api.ts`: getSharing, createSharing, deleteSharing
- Frontend: nova página ou modal de gerenciamento de compartilhamento

**#19 user_clinic_sharing** (4h)
- Similar a #18 mas para clínicas
- Modificar `ClinicFindAll` para incluir clínicas compartilhadas

**#20 marked** (2h)
- `cd frontend && npm install marked`
- `MarkdownPreview.svelte`: substituir `renderMarkdown()` por `marked.parse()`
- Configurar `marked.setOptions({ breaks: true })`

**#21 Inline create profissional em ConsultationNew** (2h)
- `ConsultationNew.svelte`: adicionar `InlineCreate` component para profissional
- Reutilizar pattern existente de `InlineCreate` para especialidades

**#22 Cache TTL no dashboard** (2h)
- `handlers/dashboard.go`: cache em memória com `sync.Mutex` + timestamp
- TTL: 5 minutos
- Invalidar cache em operações que afetam dados do dashboard

---

### Fase 4 — Baixa Prioridade (#23–#30) ~15h

**#24 Unificar migrações** (30min)
- Manter apenas `internal/migrations/` como source of truth
- Remover diretório `migrations/` raiz ou adicionar `.gitignore`

**#26 Timeout/offline no frontend** (3h)
- `api.ts`: adicionar `signal: AbortSignal.timeout(30000)` nas requisições
- Mensagem de erro específica para timeout

**#27 Campo de busca ProfessionalList** (1h)
- Input de busca filtrando por nome client-side (lista já carregada)

**#28 Limpar form ConsultationNew** (30min)
- Após criar consulta com sucesso: resetar todos os campos do form

**#29 Cache-Control uploads** (15min)
- `handlers/files.go Serve`: `w.Header().Set("Cache-Control", "private, max-age=3600")`

**#30 InlineCreate address para clinics** (1h)
- `InlineCreate.svelte`: prop opcional `showAddress: boolean`
- `ConsultationNew.svelte` e `ProfessionalDetail.svelte`: passar `showAddress={true}` para clinic

**#23 OpenAPI** (8h) — Fase 4, baixa prioridade
**#25 Bundle size analysis** (1h) — `vite build --debug`

---

## Complexity Tracking

Nenhuma violação identificada. Todos os itens seguem os princípios do CLAUDE.md:
- Sem novas dependências externas no backend
- Docker size não afetado (novas features são código Go puro)
- Sem abstrações desnecessárias (batch loading direto em SQL, não ORM)

---

## Key Technical Decisions (refs to research.md)

1. SESSION_SECRET → hash rotation via `app_config` table (simples, sem deps)
2. Rate limiting → SQLite + chi middleware (sem deps externas)
3. N+1 fix → batch loading com `IN` clause (idiomático Go + SQLite)
4. API standardization → `{ data: T }` em todos endpoints (incluindo singulares)
5. Paginação → offset-based `?page=1&limit=20` (suficiente para escala)
6. Update pattern → single dynamic SQL statement (não transaction para single ops)
7. Tema → CSS custom properties com `data-theme` attribute
8. Markdown → `marked` library (leve, sem deps transitivas)
