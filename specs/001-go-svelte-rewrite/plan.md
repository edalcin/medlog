# Implementation Plan: MedLog v2 — Complete Stack Rewrite

**Branch**: `001-go-svelte-rewrite` | **Date**: 2026-05-15 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-go-svelte-rewrite/spec.md`

## Summary

Full rewrite of MedLog from Next.js/React/Prisma/MariaDB to Go/Svelte 5/raw SQL/SQLite. The rewrite delivers a single self-contained Docker container (~25–30 MB) with no external dependencies, server-side sessions stored in SQLite, and full feature parity with the current system. The SQLite database file is already migrated from MariaDB (2026-04-24); the new stack reads the existing `.sqlite` file in-place.

## Technical Context

**Language/Version**: Go 1.25 (backend), TypeScript + Svelte 5 (frontend), Node 20 (build only)  
**Primary Dependencies**:
- Backend: `go-chi/chi` v5 (router), `alexedwards/scs` v2 + `sqlite3store` (sessions), `pressly/goose` v3 (migrations), `modernc.org/sqlite` (pure-Go SQLite driver), `golang.org/x/crypto/bcrypt` (password hashing)
- Frontend: Svelte 5, Vite 5, `@keenmate/svelte-spa-router` (SPA history-mode routing), TypeScript

**Storage**: SQLite via `modernc.org/sqlite` (no CGO). WAL mode enabled at startup via `PRAGMA journal_mode=WAL`.  
**Testing**: `go test ./...` (Go standard + testify), Vitest (Svelte)  
**Target Platform**: Linux amd64/arm64, Docker (`distroless/static:nonroot`)  
**Project Type**: Web application — REST JSON API (Go) + SPA (Svelte, served by Go)  
**Performance Goals**: Container start < 3s, page load < 2s, `/health` response < 100ms  
**Constraints**: Docker image < 30 MB (SC-001), no CGO (distroless/static requirement), JS assets < 150 KB compressed (SC-005)  
**Scale/Scope**: 2–10 concurrent users, domestic use, low write volume

## Constitution Check

Constitution template is empty (no project-specific gates defined). Applying CLAUDE.md constraints:

| Gate | Status | Notes |
|---|---|---|
| Simplicity — minimal dependencies | PASS | 5 backend deps, no ORM, no auth framework |
| Docker image size | PASS | distroless/static target ~25 MB |
| No credentials in repo | PASS | `.env.example` uses placeholders only |
| Security headers | PASS | `middleware/security.go` enforces X-Content-Type-Options, CSP, etc. |
| Single branch (main) | PASS | No feature branch created; spec lives on main |

*Re-check post-design: no violations detected after Phase 1.*

## Project Structure

### Documentation (this feature)

```text
specs/001-go-svelte-rewrite/
├── plan.md              # This file
├── research.md          # Phase 0 — library decisions
├── data-model.md        # Phase 1 — SQL schema
├── quickstart.md        # Phase 1 — dev setup
├── contracts/
│   └── api.md           # Phase 1 — REST API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 — /speckit.tasks output
```

### Source Code (repository root)

```text
cmd/
  medlog/
    main.go

internal/
  auth/
    session.go           # alexedwards/scs setup; session key constants
    middleware.go        # RequireAuth(next), RequireAdmin(next) middleware
  db/
    db.go                # sql.Open("sqlite", dsn); WAL PRAGMA; conn setup
    migrate.go           # goose.SetBaseFS + goose.Up at startup
  handlers/
    auth.go              # signin, signout, me
    consultations.go
    professionals.go
    files.go             # upload + authenticated file serving
    specialties.go
    categories.go
    clinics.go
    users.go             # admin-only CRUD
    admin.go             # stats, bulk-delete, backup, restore
    health.go
  middleware/
    security.go          # Security headers middleware
  models/                # Thin data layer (SQL queries, no ORM)
    user.go
    consultation.go
    professional.go
    file.go
    specialty.go
    clinic.go
    category.go
  embed/
    dist/                # Svelte build output — DO NOT EDIT (copied by Dockerfile)

migrations/
  001_initial_schema.sql
  002_add_sessions.sql

frontend/
  src/
    lib/
      api.ts             # Typed fetch wrappers
      auth.ts            # Auth Svelte store
      stores.ts          # Shared stores
    components/          # Reusable UI components
    routes/
      SignIn.svelte
      ConsultationList.svelte
      ConsultationDetail.svelte
      ConsultationNew.svelte
      ProfessionalList.svelte
      ProfessionalDetail.svelte
      Reports.svelte
      Admin.svelte
    App.svelte
    main.ts
  package.json
  vite.config.ts

Dockerfile
docker-compose.yml
.env.example
```

**Structure Decision**: Web application with separate backend (Go) and frontend (Svelte SPA). Frontend is built to `internal/embed/dist/` and embedded in the Go binary via `//go:embed`. No separate frontend server in production.

## Implementation Phases

### Phase A: Foundation (backend skeleton)

**Goal:** Running Go binary that serves health endpoint and connects to existing SQLite file.

Tasks:
1. Initialize Go module (`go.mod`) with all backend dependencies
2. Implement `internal/db/db.go` — open SQLite, enable WAL mode, return `*sql.DB`
3. Implement `internal/db/migrate.go` — goose embedded migration runner
4. Write `migrations/001_initial_schema.sql` (all tables, `IF NOT EXISTS`)
5. Write `migrations/002_add_sessions.sql` (sessions table)
6. Implement `cmd/medlog/main.go` — startup sequence: env validation → DB open → migrate → sessions init → routes → serve
7. Implement `GET /health` handler (FR-024)
8. Implement `ADMIN_EMAIL`/`ADMIN_PASSWORD` first-boot admin creation (FR-000)
9. **Verification:** `go run ./cmd/medlog` starts, `/health` returns 200, existing SQLite data intact

### Phase B: Auth & Session Layer

**Goal:** Working signin/signout/session middleware.

Tasks:
1. Implement `internal/auth/session.go` — SCS session manager with sqlite3store
2. Implement `internal/auth/middleware.go` — `RequireAuth` and `RequireAdmin` wrappers
3. Implement `POST /api/auth/signin`, `POST /api/auth/signout`, `GET /api/auth/me`
4. Implement `internal/middleware/security.go` — security headers
5. **Verification:** Sign in, verify session cookie, access `/api/auth/me`, sign out

### Phase C: Core API Handlers

**Goal:** All REST endpoints from contracts/api.md working.

Tasks (ordered by dependency):
1. Implement models layer (`internal/models/`) — all entities, SQL queries
2. Implement dictionary handlers: specialties, file-categories, clinics (CRUD + referential integrity check on delete)
3. Implement professionals handler (CRUD, active/inactive, N:N specialties)
4. Implement consultations handler (CRUD, user scoping for USER role, cascade delete)
5. Implement files handler (upload, authenticated serving, delete + physical file removal)
6. Implement users handler (ADMIN-only CRUD)
7. Implement admin handler (stats, bulk-delete with validation, backup, restore)
8. **Verification:** Manual API testing against all endpoints in contracts/api.md

### Phase D: Svelte Frontend

**Goal:** Feature-complete SPA with all pages from current MedLog UI.

Tasks (ordered by dependency):
1. Initialize Svelte 5 + Vite project in `frontend/`
2. Implement `lib/api.ts` — typed fetch wrappers for all API endpoints
3. Implement `lib/auth.ts` — auth store (current user, signin, signout)
4. Implement `App.svelte` with `@keenmate/svelte-spa-router` routes
5. Implement `SignIn.svelte` page
6. Implement `ConsultationList.svelte` + `ConsultationDetail.svelte` + `ConsultationNew.svelte`
7. Implement `ProfessionalList.svelte` + `ProfessionalDetail.svelte`
8. Implement `Reports.svelte` (timeline view)
9. Implement `Admin.svelte` (7 tabs: users, consultations, professionals, specialties, categories, clinics, files)
10. Implement shared components: navigation, file upload widget, Markdown preview, inline-create dialogs for dictionaries
11. **Verification:** All pages functional in browser, all acceptance scenarios from spec pass

### Phase E: Docker & Deployment

**Goal:** Production-ready Docker image under 30 MB.

Tasks:
1. Write `Dockerfile` — 3-stage: node builder → Go builder (embeds frontend) → distroless/static
2. Implement `./medlog healthcheck` subcommand (for Docker HEALTHCHECK in distroless, no curl)
3. Write `docker-compose.yml` (single service, volume mounts for data + uploads)
4. Write `.env.example`
5. Write `docker-entrypoint.sh` or integrate startup sequence in `main.go` directly
6. **Verification:** `docker build` produces image < 30 MB; `docker run` with existing `.sqlite` volume shows all data

### Phase F: Migration & Cutover

**Goal:** Existing MedLog deployments upgrade in-place with zero data loss.

Tasks:
1. Test against existing production `.sqlite` file — verify all data accessible, sessions table created, no data loss
2. Verify all 20+ FRs pass manual acceptance testing (SC-003)
3. Update `docs/` and `CLAUDE.md` to reflect new stack
4. Remove all old Next.js/React/Prisma files: `app/`, `components/`, `lib/`, `prisma/`, `scripts/`, `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, etc.
5. Commit on main branch

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `scs/sqlite3store` incompatible with `modernc.org/sqlite` driver name | Medium | High | Verify in Phase A before building auth; adapt store initialization |
| Goose migration 001 conflicts with existing Prisma schema | Low | High | All DDL uses `IF NOT EXISTS`; test against production DB copy in Phase A |
| Svelte SPA history-mode routing fails on direct URL access | Low | Medium | Go catch-all handler returns `index.html` for non-API paths |
| distroless/static HEALTHCHECK — no curl/wget | Known | Low | Binary subcommand `./medlog healthcheck` (Phase E task 2) |
| Frontend JS bundle exceeds 150 KB (SC-005) | Low | Low | Vite tree-shakes aggressively; verify with `npm run build --report` |
| Backup/restore causes 502 (documented Problem 5 from prior migration) | Known | High | server-side sessions eliminate JWT survival bug; goose+scs teardown sequence in restore handler |

## Complexity Tracking

No constitution violations requiring justification.
