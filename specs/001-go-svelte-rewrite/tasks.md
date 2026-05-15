# Tasks: MedLog v2 — Complete Stack Rewrite (Go + Svelte 5)

**Input**: Design documents from `/specs/001-go-svelte-rewrite/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: No test tasks generated (not requested in spec). Manual verification checkpoints at each phase boundary.

**Organization**: Tasks grouped by user story (spec.md) to enable independent implementation and verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1 = Single-Container, US2 = Feature Parity, US3 = Fast Interface, US4 = Backup/Restore)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — creates the new Go/Svelte structure alongside the existing Next.js codebase (do NOT delete old files yet; that happens in Polish phase).

- [x] T001 Create top-level directory structure: `cmd/medlog/`, `internal/{auth,db,handlers,middleware,models,embed/dist}`, `migrations/`, `frontend/` at repo root
- [x] T002 Initialize Go module `go.mod` with module name `medlog` and all backend dependencies: `go-chi/chi/v5`, `alexedwards/scs/v2`, `alexedwards/scs/sqlite3store`, `pressly/goose/v3`, `modernc.org/sqlite`, `golang.org/x/crypto/bcrypt`, `github.com/google/uuid`; run `go mod tidy`
- [x] T003 [P] Initialize Svelte 5 + Vite project in `frontend/` using `npm create vite@latest frontend -- --template svelte-ts`; replace generated Svelte version with Svelte 5 if needed
- [x] T004 [P] Add frontend dependencies in `frontend/package.json`: `@keenmate/svelte-spa-router`; run `npm install`
- [x] T005 [P] Configure Vite dev proxy in `frontend/vite.config.ts`: proxy `/api/*` and `/health` to `http://localhost:3000`
- [x] T006 [P] Create `frontend/src/lib/stores.ts` as empty module with placeholder exports (prevents import errors during incremental frontend build)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Implement `internal/db/db.go`: `sql.Open("sqlite", dsn)`, enable WAL mode via `PRAGMA journal_mode=WAL`, set `PRAGMA foreign_keys=ON`, set `PRAGMA busy_timeout=5000`, return `*sql.DB`
- [x] T008 Write `migrations/001_initial_schema.sql`: all existing tables from `data-model.md` using `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` — users, professionals, professional_specialties, specialties, clinics, consultations, file_categories, files (exact column definitions from data-model.md)
- [x] T009 Write `migrations/002_add_sessions.sql`: `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, data BLOB NOT NULL, expiry REAL NOT NULL)` + `CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expiry)`
- [x] T010 Implement `internal/db/migrate.go`: declare `//go:embed migrations/*.sql` FS, call `goose.SetBaseFS(embedMigrations)`, `goose.SetDialect("sqlite3")`, `goose.Up(db, "migrations")` — runs at startup
- [x] T011 Implement `internal/middleware/security.go`: middleware function that sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`
- [x] T012 Implement `internal/auth/session.go`: initialize `scs.New()` session manager, set `sqlite3store.New(db)` as store, configure `Lifetime: 7*24*time.Hour`, `Cookie.Secure: false` (dev) / `true` (prod via env), `Cookie.HttpOnly: true`, `Cookie.SameSite: http.SameSiteLaxMode`; export `Manager *scs.SessionManager`
- [x] T013 Implement `internal/auth/middleware.go`: `RequireAuth(next http.Handler)` — checks `sessions.GetString(r.Context(), "userID")`, returns 401 JSON if empty; `RequireAdmin(next http.Handler)` — checks `sessions.GetString(r.Context(), "role") == "ADMIN"`, returns 403 JSON if not
- [x] T014 Implement `cmd/medlog/main.go` skeleton: parse env vars (`DATABASE_URL`, `FILES_PATH`, `SESSION_SECRET`, `PORT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`), fail fast if required vars absent (except `ADMIN_EMAIL`/`ADMIN_PASSWORD` which are optional after first boot); open DB, run migrations, init sessions, create Chi router, wire middleware, call route registration functions (stubs for now), start HTTP server
- [x] T015 Implement first-boot admin creation in `cmd/medlog/main.go`: after migrations, query `SELECT COUNT(*) FROM users`; if 0 and `ADMIN_EMAIL`+`ADMIN_PASSWORD` set, insert admin user with bcrypt hash; if 0 and vars absent, log fatal "No users exist and ADMIN_EMAIL/ADMIN_PASSWORD not set" (FR-000)
- [x] T016 Implement `internal/handlers/health.go`: `GET /health` — ping DB with `db.PingContext(ctx)`, return `{"status":"ok","db":"connected"}` 200 or `{"status":"error","db":"unreachable"}` 503 (FR-024, SC-009)

**Checkpoint**: `go run ./cmd/medlog` starts, `/health` returns 200, existing `.sqlite` data intact, goose creates `goose_db_version` + sessions tables without breaking existing data.

---

## Phase 3: User Story 2 — Feature Parity (Priority: P1) 🎯 Largest Phase

**Goal**: All existing MedLog features work in the new Go/Svelte stack — authentication, consultations, professionals, files, dictionaries, admin panel.

**Independent Test**: Sign in → create consultation with file → view detail → open admin panel → all 7 tabs functional.

### Auth Handlers [US2]

- [x] T017 [US2] Implement `internal/models/user.go`: structs + SQL functions — `FindByEmail(db, email)`, `FindByID(db, id)`, `Create(db, email, passwordHash, name, role)`, `Update(db, id, fields)`, `Delete(db, id)`, `FindAll(db)`, `Count(db)`
- [x] T018 [US2] Implement `internal/handlers/auth.go`: `POST /api/auth/signin` (bcrypt.CompareHashAndPassword, set session userID+role+name), `POST /api/auth/signout` (Destroy session), `GET /api/auth/me` (return session data as JSON)

### Dictionary Layer [US2]

- [x] T019 [P] [US2] Implement `internal/models/specialty.go`: structs + `FindAll`, `FindByID`, `Create`, `Update`, `Delete`, `IsInUse` (checks professional_specialties count)
- [x] T020 [P] [US2] Implement `internal/models/category.go`: same pattern — `FindAll`, `FindByID`, `Create`, `Update`, `Delete`, `IsInUse` (checks files.category_id count)
- [x] T021 [P] [US2] Implement `internal/models/clinic.go`: same pattern — `FindAll`, `FindByID`, `Create`, `Update`, `Delete`, `IsInUse` (checks professionals.clinic_id count)
- [x] T022 [P] [US2] Implement `internal/handlers/specialties.go`: `GET /api/specialties`, `POST /api/specialties`, `PUT /api/specialties/:id`, `DELETE /api/specialties/:id` (returns 409 if IsInUse)
- [x] T023 [P] [US2] Implement `internal/handlers/categories.go`: `GET/POST /api/file-categories`, `PUT/DELETE /api/file-categories/:id` (returns 409 if IsInUse)
- [x] T024 [P] [US2] Implement `internal/handlers/clinics.go`: `GET/POST /api/clinics`, `PUT/DELETE /api/clinics/:id` (returns 409 if IsInUse)

### Professional Layer [US2]

- [x] T025 [US2] Implement `internal/models/professional.go`: `Professional` struct with embedded `[]Specialty` + `*Clinic`; `FindAll(db, activeOnly bool)`, `FindByID(db, id)` (JOIN specialties + clinic), `Create(db, prof, specialtyIDs)` (inserts professional + junction rows in tx), `Update(db, id, fields, specialtyIDs)` (replaces junction rows), `Delete(db, id)`, `HasConsultations(db, id)`
- [x] T026 [US2] Implement `internal/handlers/professionals.go`: `GET /api/professionals?active=true`, `POST /api/professionals`, `GET/PUT/DELETE /api/professionals/:id` (DELETE returns 409 if HasConsultations)

### Consultation Layer [US2]

- [x] T027 [US2] Implement `internal/models/consultation.go`: `Consultation` struct with embedded `Professional` + `[]File`; `FindByUserID(db, userID, filters)`, `FindAll(db, filters)`, `FindByID(db, id)`, `Create(db, consultation)`, `Update(db, id, fields)`, `Delete(db, id)` (deletes DB file records + physical files from FILES_PATH)
- [x] T028 [US2] Implement `internal/handlers/consultations.go`: full CRUD `/api/consultations` and `/api/consultations/:id` — USER role filtered to own records only (compare session userID with consultation.user_id), ADMIN sees all

### File Layer [US2]

- [x] T029 [US2] Implement `internal/models/file.go`: `FindByConsultationID(db, consultationID)`, `Create(db, file)`, `Delete(db, id)` (removes DB record; physical file removal handled in handler)
- [x] T030 [US2] Implement `internal/handlers/files.go`: `POST /api/files` — `r.ParseMultipartForm(10<<20)`, validate MIME (pdf/png/jpeg), generate UUID filename, write to `FILES_PATH`, insert DB record; `GET /api/files/:filename` — RequireAuth, `filepath.Base()` sanitization, `http.ServeContent`, `X-Content-Type-Options: nosniff`, restrict to allowed MIMEs; `DELETE /api/files/:id` — remove DB record + physical file

### Users Handler (Admin-only) [US2]

- [x] T031 [US2] Implement `internal/handlers/users.go`: `GET /api/users`, `POST /api/users` (bcrypt hash password), `GET/PUT/DELETE /api/users/:id` — all wrapped with RequireAdmin middleware

### Admin Handlers [US2]

- [x] T032 [US2] Implement `internal/handlers/admin.go` (stats + bulk-delete + files listing): `GET /api/admin/stats` (counts from each table), `GET /api/admin/consultations` (all users, paginated), `DELETE /api/admin/consultations/bulk-delete`, `GET /api/admin/professionals`, `DELETE /api/admin/professionals/bulk-delete` (validates HasConsultations for each ID, returns 409 if any), `GET /api/admin/files`

### Route Registration [US2]

- [x] T033 [US2] Register all routes in `cmd/medlog/main.go`: Chi sub-routers for `/api/auth/*` (no auth), `/api/*` (RequireAuth), `/api/admin/*` (RequireAdmin); also wire SPA catch-all (see T050)

### Frontend — API Client & Auth Store [US2]

- [x] T034 [US2] Implement `frontend/src/lib/api.ts`: typed fetch wrapper with base URL `/api`, JSON serialization, error extraction from `{"error":"..."}` responses; export typed functions for every endpoint in `contracts/api.md` (signin, signout, me, consultations CRUD, professionals CRUD, files, specialties, categories, clinics, users, admin stats/bulk-delete/files)
- [x] T035 [US2] Implement `frontend/src/lib/auth.ts`: Svelte 5 runes-based store — `currentUser` writable, `isAdmin` derived; `signin(email, password)` calls api.ts; `signout()` calls api.ts; `loadCurrentUser()` calls `/api/auth/me` on app init

### Frontend — App Shell & Navigation [US2]

- [x] T036 [US2] Implement `frontend/src/components/Navigation.svelte`: nav bar with links to /consultations, /professionals, /reports, /admin (admin-only); user name display; signout button; active route highlighting
- [x] T037 [US2] Implement `frontend/src/App.svelte`: `@keenmate/svelte-spa-router` setup with history mode; routes map (/, /signin, /consultations, /consultations/:id, /consultations/new, /professionals, /professionals/:id, /reports, /admin); auth guard — redirect to /signin if not authenticated and route is protected; `onMount` calls `auth.loadCurrentUser()`
- [x] T038 [US2] Implement `frontend/src/routes/SignIn.svelte`: email + password form, calls `auth.signin()`, redirect to /consultations on success, show error message on failure

### Frontend — Consultations Pages [US2]

- [x] T039 [P] [US2] Implement `frontend/src/routes/ConsultationList.svelte`: paginated list from `GET /api/consultations`, filter by professional + date range, consultation type badge (CONSULTATION/EVENT), date-sorted, click to detail
- [x] T040 [P] [US2] Implement `frontend/src/routes/ConsultationDetail.svelte`: fetch by ID, display date/type/professional/notes (Markdown rendered via MarkdownPreview), files list with download links, edit notes inline, delete button (with confirmation), link to add file
- [x] T041 [P] [US2] Implement `frontend/src/routes/ConsultationNew.svelte`: form for date, type (select), professional (select active only), notes (textarea), file upload widget (FileUpload component); inline professional creation button; save calls `POST /api/consultations` then redirects to detail

### Frontend — Professionals Pages [US2]

- [x] T042 [P] [US2] Implement `frontend/src/routes/ProfessionalList.svelte`: list with active/inactive filter toggle, specialty badges, clinic name; click to detail
- [x] T043 [P] [US2] Implement `frontend/src/routes/ProfessionalDetail.svelte`: display + edit form for name/notes/isActive/specialties (multi-select with inline create)/clinic (select with inline create); save calls PUT; delete with confirmation

### Frontend — Reports & Admin [US2]

- [x] T044 [US2] Implement `frontend/src/routes/Reports.svelte`: chronological timeline of all consultations for current user, grouped by year/month, with professional name + type badge
- [x] T045 [US2] Implement `frontend/src/routes/Admin.svelte`: 7-tab layout — Tab 1 Users (CRUD table), Tab 2 All Consultations (paginated + bulk delete), Tab 3 All Professionals (paginated + bulk delete with 409 handling), Tab 4 Specialties (CRUD), Tab 5 File Categories (CRUD), Tab 6 Clinics (CRUD), Tab 7 All Files (read-only table with metadata)

### Frontend — Shared Components [US2]

- [x] T046 [P] [US2] Implement `frontend/src/components/FileUpload.svelte`: accepts `consultationId` and `professionalId` props, renders file input + category select, calls `POST /api/files` multipart, shows upload progress, emits `uploaded` event on success, shows 413/415 errors
- [x] T047 [P] [US2] Implement `frontend/src/components/MarkdownPreview.svelte`: renders Markdown string to HTML using a lightweight parser (marked.js or custom); sanitize output to prevent XSS
- [x] T048 [P] [US2] Implement `frontend/src/components/InlineCreate.svelte`: reusable modal — accepts `resourceType` (specialty/category/clinic), `label` prop; POST to appropriate API endpoint on submit; emits `created` event with new entity
- [x] T049 [US2] Implement `frontend/src/main.ts`: mount App.svelte on `document.body`, import global styles

### Frontend Build Embedding [US2]

- [x] T050 [US2] Add `//go:embed` directive: create `internal/embed/embed.go` with `//go:embed dist` pointing to `internal/embed/dist/`; implement SPA handler in `cmd/medlog/main.go` that serves embedded files for non-`/api/*`, non-`/health` paths, falling back to `index.html` for SPA routes; update Dockerfile build stage to copy `frontend/dist/` to `internal/embed/dist/` before `go build`

**Checkpoint**: Full app works end-to-end. Sign in → create consultation → upload file → view admin panel → all 7 tabs → sign out.

---

## Phase 4: User Story 1 — Single-Container Deployment (Priority: P1)

**Goal**: `docker run` with one volume mount starts MedLog — no external database, all data persists.

**Independent Test**: `docker build -t medlog:v2 . && docker run -p 3000:3000 -v /tmp/test-data:/data -e ADMIN_EMAIL=test@test.com -e ADMIN_PASSWORD=test medlog:v2` — login page appears, all features work, image < 30 MB.

- [x] T051 [US1] Write `Dockerfile`: Stage 1 `FROM node:20-alpine AS frontend-builder` — `npm ci && npm run build`; Stage 2 `FROM golang:1.24-alpine AS go-builder` — `COPY --from=frontend-builder /frontend/dist ./internal/embed/dist`, `CGO_ENABLED=0 GOOS=linux go build -a -ldflags='-s -w' -o medlog ./cmd/medlog`; Stage 3 `FROM gcr.io/distroless/static:nonroot` — `COPY --from=go-builder /app/medlog /medlog`, `EXPOSE 3000`, `ENTRYPOINT ["/medlog"]`
- [x] T052 [US1] Implement `healthcheck` subcommand in `cmd/medlog/main.go`: `if os.Args[1] == "healthcheck"` — make HTTP GET to `http://localhost:$PORT/health`, exit 0 if 200, exit 1 otherwise; used by Docker HEALTHCHECK since distroless/static has no curl
- [x] T053 [US1] Add `HEALTHCHECK CMD ["/medlog", "healthcheck"]` with `--interval=30s --timeout=3s --start-period=10s --retries=3` to Dockerfile (FR-024)
- [x] T054 [US1] Write `docker-compose.yml`: single `medlog` service, image build from local Dockerfile, port `3000:3000`, volumes for `/data/db` (SQLite) and `/data/uploads` (files), env vars referencing `.env` file
- [x] T055 [P] [US1] Write `.env.example`: all variables with placeholder values and comment explaining each (`DATABASE_URL`, `FILES_PATH`, `SESSION_SECRET`, `PORT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- [ ] T056 [US1] Run `docker build -t medlog:v2 .` and verify build succeeds; run `docker images medlog:v2` and confirm size < 30 MB (SC-001)
- [ ] T057 [US1] Run `docker run` with existing SQLite volume, verify: all data visible, migrations applied, `/health` returns 200, container starts in < 3s (SC-002), first-boot admin creation works on fresh volume
  > **Manual step** — requires Docker daemon

**Checkpoint**: Container runs single-service with volume-mounted SQLite, image < 30 MB.

---

## Phase 5: User Story 4 — Database Backup and Restore (Priority: P2)

**Goal**: Admin downloads a complete `.sqlite` backup and restores from file without container restart.

**Independent Test**: Backup → stop container → delete data volume → start fresh → restore → verify all original data present + no 502 errors.

- [x] T058 [US4] Implement `GET /api/admin/backup` in `internal/handlers/admin.go`: run `PRAGMA wal_checkpoint(TRUNCATE)` via `db.QueryRowContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)")`, read `.sqlite` file from `FILES_PATH`-adjacent db path, set `Content-Disposition: attachment; filename=medlog-backup-YYYYMMDD.sqlite`, serve with `io.Copy`
- [x] T059 [US4] Implement `InvalidateAllSessions(db *sql.DB)` helper in `internal/auth/session.go`: executes `DELETE FROM sessions` (inline in Restore handler)
- [x] T060 [US4] Implement `POST /api/admin/restore` in `internal/handlers/admin.go`: validate SQLite magic bytes (`53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00`), write upload to temp file, call `sessions.Manager.Clear(ctx)` + `sessions.InvalidateAllSessions(db)`, close DB connection, delete WAL (`db_path-wal`) and SHM (`db_path-shm`) files if they exist, `os.Rename(tempFile, dbPath)`, reopen DB connection (`db.Ping()` to reconnect), return `{"ok":true,"message":"Restauração concluída. Faça login novamente."}`
- [x] T061 [US4] Wire backup and restore routes in `cmd/medlog/main.go` under `/api/admin/*` with RequireAdmin middleware
- [x] T062 [US4] Add backup/restore UI to `frontend/src/routes/Admin.svelte`: add "Backup & Restore" section (can be a new tab or within existing admin panel); backup section with "Download Backup" button; restore section with file input (accepts `.sqlite`) + "Restore" button + confirmation dialog warning data will be replaced + post-restore message instructing user to sign in again
- [ ] T063 [US4] Manual test: trigger backup → verify downloaded file opens with SQLite browser → verify WAL is not present in the download
- [ ] T064 [US4] Manual test: restore with a valid backup → verify session invalidated (redirected to signin) → verify all data from backup present → verify no container restart needed (SC-007, SC-008)

**Checkpoint**: Admin can backup and restore. Post-restore: all sessions invalidated, no 502 errors, no container restart.

---

## Phase 6: User Story 3 — Fast and Responsive Interface (Priority: P2)

**Goal**: Frontend assets < 150 KB compressed, container starts in < 3s, pages interactive in < 2s.

**Independent Test**: Open browser DevTools → Network tab → hard reload → JS total < 150 KB gzipped; `docker stats` shows startup time < 3s.

- [x] T065 [US3] Run `cd frontend && npm run build` and inspect `dist/` asset sizes — 109 kB JS / 16 kB CSS (SC-005 target < 150 KB ✓)
- [x] T066 [P] [US3] Bundle under 150 KB — no lazy loading needed; inline Markdown renderer used instead of marked.js
- [ ] T067 [P] [US3] Verify container startup time: `time docker run --rm ... medlog:v2` + `/health` — should complete in < 3s (SC-002) — requires Docker
- [ ] T068 [P] [US3] Verify page load time in browser DevTools — target < 2s (SC-002) — requires running instance
- [ ] T069 [US3] Run full Success Criteria verification checklist (SC-001 through SC-009) per spec.md; document results in `specs/001-go-svelte-rewrite/sc-results.md`

**Checkpoint**: All 9 success criteria from spec verified and documented.

---

## Phase 7: Polish & Cutover

**Purpose**: Remove old stack files, finalize documentation, commit.

- [x] T070 Delete old Next.js/React/Prisma files: `app/`, `components/`, `lib/` (Next.js lib), `prisma/`, `scripts/` (seed scripts), `public/`, `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json` (root), `package.json` (root), `package-lock.json` (root) — verify `go run ./cmd/medlog` still works after deletion
- [x] T071 Update `CLAUDE.md`: remove Next.js/Prisma/MariaDB/React references; update tech stack, development commands, architecture, env vars, project structure sections to reflect Go/Svelte/SQLite/goose/scs
- [x] T072 [P] Update `.gitignore`: add `/medlog` (Go binary), `frontend/dist/`, `frontend/node_modules/`, `internal/embed/dist/`, `*.sqlite-wal`, `*.sqlite-shm`, keep existing ignores for `.env`
- [x] T073 [P] Verify no secrets in tracked files: `git diff --cached` shows no `.env`, no passwords, `.env.example` has only placeholder values
- [x] T074 [P] Update `docs/`: archive `STACK_COMPARATIVO.md` with note that migration was completed; update any other docs referencing old stack
- [ ] T075 Create final git commit on main branch with message summarizing the v2 rewrite

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US2 Feature Parity)**: Depends on Phase 2 — largest phase, do first among user stories
- **Phase 4 (US1 Docker)**: Depends on Phase 3 (needs working app to containerize)
- **Phase 5 (US4 Backup/Restore)**: Depends on Phase 3 (auth layer) + Phase 4 (Docker verification)
- **Phase 6 (US3 Performance)**: Depends on Phase 3 frontend complete
- **Phase 7 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US2 (P1)**: After Foundational — no story dependencies
- **US1 (P1)**: After US2 — needs working app to containerize
- **US4 (P2)**: After US2 auth + Phase 4 Docker — reuses auth session infrastructure
- **US3 (P2)**: After US2 frontend — optimizes existing Svelte build

### Within Phase 3 (US2) — Internal Ordering

1. T017–T018 (auth) → must precede all handler work (routes require auth middleware)
2. T019–T024 (dictionaries) → parallel; must precede T025–T026 (professionals use clinic/specialty)
3. T025–T026 (professionals) → must precede T027–T028 (consultations reference professionals)
4. T027–T028 (consultations) → must precede T029–T030 (files reference consultations)
5. T031–T032 (users/admin) → parallel with T027–T030
6. T033 (route registration) → after all handlers
7. T034–T038 (frontend shell + auth) → parallel with backend T025–T032
8. T039–T049 (frontend pages + components) → parallel after T034–T038
9. T050 (embed) → after `npm run build` produces `frontend/dist/`

### Parallel Opportunities

Phase 2: T012–T013 can start while T007–T011 are in progress (different files)

Phase 3 parallel groups:
- T019, T020, T021 (model files) — all parallel
- T022, T023, T024 (handler files) — all parallel
- T039, T040, T041 (consultation pages) — all parallel
- T042, T043 (professional pages) — parallel
- T046, T047, T048 (shared components) — all parallel

---

## Parallel Example: Phase 3 Dictionary Layer

```
# All 6 tasks launch simultaneously (different files):
Task T019: internal/models/specialty.go
Task T020: internal/models/category.go
Task T021: internal/models/clinic.go
Task T022: internal/handlers/specialties.go
Task T023: internal/handlers/categories.go
Task T024: internal/handlers/clinics.go
```

## Parallel Example: Phase 3 Svelte Pages

```
# After T036–T038 complete, these 6 tasks run simultaneously:
Task T039: frontend/src/routes/ConsultationList.svelte
Task T040: frontend/src/routes/ConsultationDetail.svelte
Task T041: frontend/src/routes/ConsultationNew.svelte
Task T042: frontend/src/routes/ProfessionalList.svelte
Task T043: frontend/src/routes/ProfessionalDetail.svelte
Task T046: frontend/src/components/FileUpload.svelte
Task T047: frontend/src/components/MarkdownPreview.svelte
Task T048: frontend/src/components/InlineCreate.svelte
```

---

## Implementation Strategy

### MVP First (US2 Backend + US1 Docker Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3 T017–T033: Backend API only (no Svelte)
4. Complete Phase 4: Docker packaging
5. **STOP and VALIDATE**: API works via curl, container runs, image < 30 MB
6. Use existing Next.js frontend temporarily if needed

### Full Incremental Delivery

1. Setup + Foundational → Go binary serves `/health`
2. US2 backend (T017–T033) → all API endpoints working
3. US2 frontend (T034–T050) → full SPA, replaces Next.js
4. US1 Docker (T051–T057) → single-container deployment
5. US4 Backup/Restore (T058–T064) → operational safety
6. US3 Performance (T065–T069) → verify targets
7. Polish (T070–T075) → remove old stack, commit

---

## Notes

- [P] tasks = different files, no incomplete-task dependencies
- [Story] label maps to spec.md user story for traceability
- No test tasks generated (not in spec); each phase has manual checkpoint verification
- **Critical risk**: test T007 + T008 against a COPY of the production `.sqlite` before touching production volume (see research.md Q2 — goose migration 001 must be idempotent)
- Driver name: `modernc.org/sqlite` registers as `"sqlite"` — use `sql.Open("sqlite", dsn)` everywhere (NOT `"sqlite3"`)
- Commit after each checkpoint, not after each task
- Do NOT delete old Next.js files until Phase 7 (T070) — keep app running during incremental build
