# Quickstart: MedLog v2 Development Setup

## Prerequisites

- Go 1.25+
- Node.js 20+ (for Svelte frontend)
- Docker (for integration testing or full-stack dev)

## Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=file:./data/medlog.sqlite
FILES_PATH=./data/uploads
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
SESSION_SECRET=generate-with-openssl-rand-base64-32
PORT=3000
```

## Running in Development

**Terminal 1 — Go backend:**
```bash
go mod tidy
go run ./cmd/medlog
# Starts on http://localhost:3000
# Serves API + compiled frontend assets
```

**Terminal 2 — Svelte frontend (hot reload):**
```bash
cd frontend
npm install
npm run dev
# Starts on http://localhost:5173
# Proxies /api/* to Go backend on :3000
```

`vite.config.ts` proxy configuration:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/health': 'http://localhost:3000',
  }
}
```

## Building

```bash
# Build frontend first
cd frontend && npm run build && cd ..

# Build Go binary (embeds frontend/dist/)
CGO_ENABLED=0 go build -o medlog ./cmd/medlog

# Run production binary
./medlog
```

## Docker

```bash
docker build -t medlog:v2 .

docker run -p 3000:3000 \
  -v /path/to/data:/data \
  -e DATABASE_URL=file:/data/db/medlog.sqlite \
  -e FILES_PATH=/data/uploads \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=changeme \
  -e SESSION_SECRET=$(openssl rand -base64 32) \
  medlog:v2
```

## Key Commands

```bash
# Run Go tests
go test ./...

# Run frontend tests
cd frontend && npm test

# Check health endpoint
curl http://localhost:3000/health

# Generate a session secret
openssl rand -base64 32
```

## Project Structure

```
cmd/
  medlog/
    main.go                  # Entry point: setup, migrations, routes, serve

internal/
  auth/
    session.go               # SCS session manager setup
    middleware.go            # RequireAuth, RequireAdmin middleware
  db/
    db.go                    # sql.Open, WAL mode PRAGMA, connection setup
    migrate.go               # goose.Up(db, "migrations") at startup
  handlers/
    auth.go                  # POST /api/auth/signin|signout, GET /api/auth/me
    consultations.go         # CRUD /api/consultations
    professionals.go         # CRUD /api/professionals
    files.go                 # POST /api/files, GET /api/files/:filename, DELETE
    specialties.go           # CRUD /api/specialties
    categories.go            # CRUD /api/file-categories
    clinics.go               # CRUD /api/clinics
    users.go                 # CRUD /api/users (ADMIN only)
    admin.go                 # /api/admin/* (stats, bulk-delete, backup, restore)
    health.go                # GET /health
  middleware/
    security.go              # Security headers (X-Content-Type-Options, etc.)
  models/
    user.go
    consultation.go
    professional.go
    file.go
    specialty.go
    clinic.go
    category.go
  embed/
    dist/                    # Svelte build output (copied by Dockerfile/Makefile)

migrations/
  001_initial_schema.sql     # All existing tables (IF NOT EXISTS)
  002_add_sessions.sql       # sessions table (new in v2)

frontend/
  src/
    lib/
      api.ts                 # Typed fetch wrappers for all API endpoints
      auth.ts                # Auth store (current user, signin, signout)
      stores.ts              # Shared Svelte stores
    components/              # Reusable UI components
    routes/
      SignIn.svelte
      ConsultationList.svelte
      ConsultationDetail.svelte
      ConsultationNew.svelte
      ProfessionalList.svelte
      ProfessionalDetail.svelte
      Reports.svelte
      Admin.svelte
    App.svelte               # Root: router + nav
    main.ts
  package.json
  vite.config.ts

Dockerfile                   # 3-stage: node builder → go builder → distroless/static
docker-compose.yml
.env.example
```
