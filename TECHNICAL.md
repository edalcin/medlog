# Documentação Técnica — MedLog v2

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Go 1.24 |
| Router | go-chi/chi v5 |
| Sessões | alexedwards/scs v2 (armazenadas no SQLite) |
| Migrações | pressly/goose v3 |
| Banco | SQLite via modernc.org/sqlite (pure-Go, CGO_ENABLED=0) |
| Frontend | Svelte 5 + Vite 5 + TypeScript |
| Roteamento SPA | @keenmate/svelte-spa-router |
| Markdown | marked v18 |
| Deploy | Docker multi-stage (alpine:3.21, ~30MB imagem final) |

O frontend é compilado em tempo de build e embutido no binário Go via `//go:embed`. O resultado é um único executável sem dependências externas além do SQLite.

---

## Arquitetura

```
┌─────────────────────────────────────────┐
│           Browser                       │
│   Svelte 5 SPA (embutido no binário)    │
└───────────────────┬─────────────────────┘
                    │ HTTP/JSON
┌───────────────────▼─────────────────────┐
│           Go Binary (:3000)             │
│                                         │
│  chi router                             │
│  ├── /api/*   → handlers/               │
│  ├── /api/files/* → serve uploads       │
│  └── /*       → embed/dist (SPA)        │
│                                         │
│  alexedwards/scs (sessions em SQLite)   │
│  DashboardHandler (cache 5min sync.Map) │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│     SQLite (WAL, foreign keys on)       │
│     + volume de uploads (arquivos)      │
└─────────────────────────────────────────┘
```

---

## Estrutura do Projeto

```
cmd/medlog/main.go              # Entry point — wiring de handlers e rotas
internal/
  auth/
    session.go                  # SCS session manager + rotação de SESSION_SECRET
    middleware.go               # RequireAuth, RequireAdmin
  db/
    db.go                       # sql.Open + PRAGMA WAL + foreign keys
    migrate.go                  # goose executa migrations no startup
    testhelper.go               # SetupTestDB(:memory:) para testes
  handlers/                     # Handlers HTTP por domínio
    auth.go                     # SignIn, SignOut, Me
    consultations.go
    professionals.go
    clinics.go
    specialties.go
    categories.go
    files.go
    phones.go                   # CRUD telefones de profissionais/clínicas
    sharing.go                  # Compartilhamento entre usuários
    users.go                    # CRUD usuários + /me/password + /me/theme + /others
    admin.go                    # Admin: stats, bulk-delete, backup/restore, login-logs
    dashboard.go                # Dashboard com cache TTL 5min
    helpers.go                  # parsePagination, writeJSON, writePagedJSON, writeDBError
    auth_test.go
    consultations_test.go
    professionals_test.go
  middleware/
    security.go                 # CSP, X-Frame-Options, HSTS, nosniff
    ratelimit.go                # Rate limiting SQLite (5 req/min/IP) para /auth/signin
  models/                       # Funções SQL (sem ORM)
    user.go
    consultation.go
    professional.go
    clinic.go
    specialty.go
    file.go
    phone.go                    # PhoneFindBy*, PhoneCreate, PhoneBelongsToUser
    sharing.go                  # ProfessionalSharing*, ClinicSharing*
    login_log.go                # LoginLogFindAll
    helpers.go                  # inClause, anySlice (batch queries)
    user_test.go
    consultation_test.go
    professional_test.go
  embed/                        # Build do Svelte embutido
  migrations/                   # SQL embutidos para goose (fonte canônica)
    001_initial_schema.sql
    002_add_sessions.sql
    003_rate_limiting_and_config.sql
    004_login_logs_extended.sql
    migrations.go               # //go:embed *.sql
frontend/
  src/lib/api.ts                # Cliente API tipado (todos os endpoints)
  src/lib/auth.ts               # Stores + setTheme + signout
  src/routes/
    Dashboard.svelte
    ConsultationList.svelte
    ConsultationNew.svelte      # Inline create de profissional
    ConsultationDetail.svelte
    ProfessionalList.svelte     # Busca por nome + filtro ativo
    ProfessionalDetail.svelte   # CRUD + phones + specialties + clinic
    Sharing.svelte              # Gerenciar compartilhamento com outros usuários
    Reports.svelte
    Admin.svelte                # Todos os tabs admin incluindo login logs
    SignIn.svelte
  src/components/
    Navigation.svelte           # Cyclo de tema SYSTEM/LIGHT/DARK
    FileUpload.svelte
    InlineCreate.svelte         # Suporta specialties, clinics (c/ address), professionals
    MarkdownPreview.svelte      # marked.parse()
```

---

## Schema do Banco de Dados

```
users
  id, email, username, name, password_hash
  role (ADMIN|USER), theme (SYSTEM|LIGHT|DARK)
  created_at, updated_at

specialties
  id, name UNIQUE, created_at

clinics
  id, name, address, user_id → users, created_at, updated_at
  UNIQUE(name, user_id)

professionals
  id, name, crm, address, notes, is_active
  user_id → users, clinic_id → clinics, created_at, updated_at

professional_specialties
  id, professional_id → professionals, specialty_id → specialties, created_at
  UNIQUE(professional_id, specialty_id)

phones
  id, number, label
  professional_id → professionals (nullable)
  clinic_id → clinics (nullable)
  created_at

user_professional_sharing
  id, sharing_from_user_id → users, sharing_to_user_id → users, created_at
  UNIQUE(sharing_from_user_id, sharing_to_user_id)

user_clinic_sharing
  id, sharing_from_user_id → users, sharing_to_user_id → users, created_at
  UNIQUE(sharing_from_user_id, sharing_to_user_id)

consultations
  id, date, proposito, notes (Markdown), type (CONSULTATION|EVENT), rating (1-5)
  user_id → users, professional_id → professionals, created_at, updated_at

file_categories
  id, name UNIQUE, created_at

files
  id, filename, custom_name, path, mime_type, size, hash
  consultation_id → consultations, professional_id → professionals
  user_id → users, uploaded_at

file_file_categories
  id, file_id → files, category_id → file_categories, created_at
  UNIQUE(file_id, category_id)

login_logs
  id, user_id → users, timestamp, ip_address, user_agent

rate_limit_attempts
  ip TEXT, window_start TEXT, attempts INT
  UNIQUE(ip, window_start)

app_config
  key TEXT PRIMARY KEY, value TEXT

sessions                        # gerenciado pelo alexedwards/scs
  token, data, expiry
```

**Cascade deletes:**
- `users` delete → cascata em `consultations`, `professionals`, `clinics`, `files`, `phones` (via profissional/clínica), `login_logs`
- `consultations` delete → cascata em `files`
- `professionals` delete → cascata em `professional_specialties`, `phones`
- `clinics` delete → SET NULL em `professionals.clinic_id`; cascata em `phones`

---

## Rotas da API

### Autenticação pública
```
POST   /api/auth/signin          Rate-limited (5 req/min/IP)
POST   /api/auth/signout
```

### Autenticadas (RequireAuth)
```
GET    /api/auth/me
GET    /api/users/others         Lista outros usuários (id+nome) para sharing
PUT    /api/users/me/password    Alterar própria senha (verifica senha atual)
PATCH  /api/users/me/theme       Alterar tema (LIGHT|DARK|SYSTEM)

GET    /api/dashboard

GET    /api/specialties
GET    /api/file-categories

GET    /api/clinics
POST   /api/clinics
PUT    /api/clinics/{id}
DELETE /api/clinics/{id}
GET    /api/clinics/{id}/phones
POST   /api/clinics/{id}/phones

GET    /api/professionals
POST   /api/professionals
GET    /api/professionals/{id}
PUT    /api/professionals/{id}
DELETE /api/professionals/{id}
GET    /api/professionals/{id}/phones
POST   /api/professionals/{id}/phones

PUT    /api/phones/{id}
DELETE /api/phones/{id}

GET    /api/consultations
POST   /api/consultations
GET    /api/consultations/{id}
PUT    /api/consultations/{id}
DELETE /api/consultations/{id}

POST   /api/files
GET    /api/files/{filename}     Cache-Control: private, max-age=3600
DELETE /api/files/{id}

GET    /api/sharing/professionals
POST   /api/sharing/professionals
DELETE /api/sharing/professionals/{userId}
GET    /api/sharing/clinics
POST   /api/sharing/clinics
DELETE /api/sharing/clinics/{userId}
```

### Administração (RequireAdmin)
```
POST   /api/specialties
PUT    /api/specialties/{id}
DELETE /api/specialties/{id}

POST   /api/file-categories
PUT    /api/file-categories/{id}
DELETE /api/file-categories/{id}

GET    /api/users
POST   /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
PUT    /api/users/{id}/password
DELETE /api/users/{id}

GET    /api/admin/stats
GET    /api/admin/consultations
POST   /api/admin/consultations/bulk-delete
GET    /api/admin/professionals
POST   /api/admin/professionals/bulk-delete
GET    /api/admin/files
GET    /api/admin/login-logs
GET    /api/admin/backup
POST   /api/admin/restore
```

---

## Desenvolvimento Local

### Pré-requisitos

- Go 1.24+
- Node.js 20+

### Setup

```bash
# Clone
git clone https://github.com/edalcin/medlog.git
cd medlog

# Backend
cp .env.example .env   # edite conforme necessário
go run ./cmd/medlog

# Frontend (hot reload em :5173, proxies /api → :3000)
cd frontend
npm install
npm run dev
```

### Variáveis de ambiente (`.env`)

```env
DATABASE_URL=file:./data/medlog.sqlite
FILES_PATH=./data/uploads
SESSION_SECRET=gere_com_openssl_rand_base64_32
PORT=3000
ADMIN_EMAIL=admin@exemplo.com
ADMIN_PASSWORD=senha_forte
SESSION_SECURE=false
TRUST_PROXY=false
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | sim | Caminho para o SQLite (`file:` prefix obrigatório) |
| `FILES_PATH` | sim | Diretório de uploads |
| `SESSION_SECRET` | sim | Chave de 32+ chars. Rotacionar invalida todas as sessões |
| `PORT` | não | Porta do servidor (padrão: `3000`) |
| `ADMIN_EMAIL` | primeiro boot | Email do admin inicial |
| `ADMIN_PASSWORD` | primeiro boot | Senha do admin inicial |
| `SESSION_SECURE` | não | `true` em produção (HTTPS). Padrão: `false` |
| `TRUST_PROXY` | não | `true` se atrás de proxy reverso (ativa X-Forwarded-For para rate limiting) |

### Comandos

```bash
# Backend
go run ./cmd/medlog       # dev server em :3000
go build ./...            # verificar compilação
go test ./...             # testes de integração

# Frontend
cd frontend
npm run dev               # hot reload em :5173
npm run build             # build → internal/embed/dist/

# Docker
docker build -t medlog:local .
docker compose up
```

---

## Autenticação e Sessões

- Credenciais email + bcrypt — sem OAuth
- Sessões server-side via `alexedwards/scs` armazenadas no SQLite
- `SESSION_SECRET`: hash SHA256 armazenado em `app_config`; se mudar, todas as sessões são invalidadas automaticamente
- Roles: `ADMIN` (acesso global) e `USER` (acesso aos próprios dados)
- Rate limiting: 5 tentativas/minuto por IP no `POST /auth/signin`; retorna 429 + `Retry-After: 60`
- Login registrado em `login_logs` com IP e user-agent

---

## Compartilhamento entre Usuários

Um usuário pode compartilhar seus profissionais e/ou clínicas com outros usuários:

- Gerenciado em `/sharing` (página acessível a qualquer usuário)
- Profissionais/clínicas compartilhados aparecem na lista do destinatário com badge "Compartilhado" e são somente leitura
- Tabelas: `user_professional_sharing`, `user_clinic_sharing`
- `GET /api/professionals` usa UNION ALL para combinar próprios + compartilhados
- `GET /api/users/others` retorna `[{id, name}]` para seleção de destinatários

---

## Tema do Usuário

- Valores: `SYSTEM` (usa media query do OS), `LIGHT`, `DARK`
- Persistido na coluna `theme` da tabela `users` e na sessão
- Frontend: `App.svelte` aplica `data-theme="light|dark"` em `<html>`; SYSTEM remove o atributo
- `app.css` usa `:root,[data-theme="dark"]` para dark, `[data-theme="light"]` e `@media (prefers-color-scheme: light)` para light

---

## Upload de Arquivos

- Tipos aceitos: PDF, PNG, JPG (max 10MB)
- Filename: `{uuid}.{ext}` — nunca expõe nome original no filesystem
- Caminho: `{FILES_PATH}/{uuid}.{ext}`
- Acesso via: `GET /api/files/{filename}` (requer autenticação)
- Cache-Control: `private, max-age=3600` — UUIDs são imutáveis

---

## Backup e Restauração

Disponível em Admin → aba **Backup & Restauração**:

- **Backup:** faz `PRAGMA wal_checkpoint(TRUNCATE)` e serve o arquivo `.sqlite` diretamente
- **Restauração:** valida magic bytes SQLite, substitui atomicamente via rename, re-pinga a conexão, invalida sessões ativas

---

## Testes

Testes de integração usando SQLite `:memory:` + goose migrations:

```bash
go test ./...
```

Cobertura:
- `internal/models/` — user, consultation, professional (crud + batch specialties + count)
- `internal/handlers/` — auth (rate limit), consultations (pagination), professionals (list format)

Helpers:
- `internal/db/testhelper.go` — `SetupTestDB(t)`: abre `:memory:`, roda migrations, registra cleanup
- `handlers_test` — `wrapWithSession()`, `signInAndGetCookie()` para testes de handler

---

## Docker

Build multi-stage:
1. `node:20-alpine` → compila o Svelte
2. `golang:1.24-alpine` → compila o binário Go com frontend embutido (`CGO_ENABLED=0`)
3. `alpine:3.21` → imagem final (~30MB) com apenas o binário

Sem dependência de banco externo — SQLite é embedded.

Healthcheck integrado: `GET /health` ou `/medlog healthcheck` (modo CLI).

---

## Contribuindo

PRs são bem-vindos. Mantenha o stack simples e a imagem Docker pequena.
