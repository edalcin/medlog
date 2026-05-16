# Documentação Técnica — MedLog

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
│  ├── /files/* → serve uploads           │
│  └── /*       → embed/dist (SPA)        │
│                                         │
│  alexedwards/scs (sessions em SQLite)   │
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
    session.go                  # SCS session manager
    middleware.go               # RequireAuth, RequireAdmin
  db/
    db.go                       # sql.Open + PRAGMA WAL
    migrate.go                  # goose executa migrations no startup
  handlers/                     # Handlers HTTP por domínio
  middleware/security.go        # Security headers
  models/                       # Funções SQL (sem ORM)
  embed/                        # Build do Svelte embutido
  migrations/                   # SQL embutidos para goose
migrations/                     # Fontes SQL (versionados)
frontend/
  src/lib/api.ts                # Cliente API tipado
  src/lib/auth.ts               # Stores de autenticação
  src/routes/                   # Páginas (Dashboard, Consultations, etc.)
  src/components/               # Componentes reutilizáveis
  public/                       # Assets estáticos (doctor-icon.png, etc.)
```

---

## Schema do Banco de Dados

```
users
  id, email, username, name, password_hash, role (ADMIN|USER), theme, timestamps

specialties
  id, name (unique), created_at

clinics
  id, name, address, user_id → users, timestamps
  UNIQUE(name, user_id)

professionals
  id, name, crm, address, notes, is_active, user_id → users, clinic_id → clinics, timestamps

professional_specialties
  id, professional_id → professionals, specialty_id → specialties, created_at
  UNIQUE(professional_id, specialty_id)

consultations
  id, date, proposito, notes (Markdown), type (CONSULTATION|EVENT), rating (1-5)
  user_id → users, professional_id → professionals, timestamps

file_categories
  id, name (unique), created_at

files
  id, filename, custom_name, path, mime_type, size, hash, thumbnail_path
  consultation_id → consultations, professional_id → professionals, user_id → users, uploaded_at

file_file_categories
  id, file_id → files, category_id → file_categories, created_at
  UNIQUE(file_id, category_id)

sessions                        # gerenciado pelo scs
  token, data, expiry
```

**Cascade deletes:**
- `users` delete → cascata em `consultations`, `professionals`, `clinics`, `files`
- `consultations` delete → cascata em `files`
- `professionals` delete → cascata em `professional_specialties`
- `clinic` delete → SET NULL em `professionals.clinic_id`

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
```

### Comandos

```bash
# Backend
go run ./cmd/medlog       # dev server em :3000
go build ./...            # verificar compilação
go test ./...             # testes

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

- Credenciais (email + bcrypt password) — sem OAuth
- Sessões server-side via `alexedwards/scs` armazenadas no SQLite
- Roles: `ADMIN` (acesso global) e `USER` (acesso aos próprios dados)
- Profissionais e clínicas são user-scoped (`user_id`): cada usuário vê os próprios + os globais (`user_id IS NULL`)
- ADMIN vê todos os registros de todos os usuários

---

## Upload de Arquivos

- Tipos aceitos: PDF, PNG, JPG (max 10MB)
- Filename: `{uuid}.{ext}` — nunca expõe nome original no filesystem
- Caminho: `{FILES_PATH}/{uuid}.{ext}`
- Acesso via: `GET /api/files/{filename}` (requer autenticação)

---

## Backup e Restauração

Disponível no Painel Administrativo → aba "Backup & Restauração":

- **Backup:** faz `PRAGMA wal_checkpoint(TRUNCATE)` e serve o arquivo `.sqlite` diretamente
- **Restauração:** valida magic bytes SQLite, substitui atomicamente via rename, re-pinga a conexão, invalida sessões ativas

---

## Docker

Build multi-stage:
1. `node:20-alpine` → compila o Svelte
2. `golang:1.24-alpine` → compila o binário Go com frontend embutido (`CGO_ENABLED=0`)
3. `alpine:3.21` → imagem final (~30MB) com apenas o binário

Sem dependência de banco externo — SQLite é embedded.

---

## Contribuindo

PRs são bem-vindos. Mantenha o stack simples e a imagem Docker pequena.
