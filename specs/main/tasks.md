# Tasks: MedLog v2 — Code Review Full Implementation

**Input**: `specs/main/plan.md`, `specs/main/spec.md`, `specs/main/data-model.md`, `specs/main/contracts/api.md`
**Branch**: `main`
**Stack**: Go 1.24, Svelte 5, SQLite, chi v5, scs v2, goose v3

**No TDD**: Tests are a deliverable (#16), not a prerequisite. No test tasks precede implementation tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no cross-task dependency)
- **[Story]**: User story label (US1–US12)

---

## Phase 1: Setup

**Purpose**: New migration files and frontend dependency needed before any feature work.

- [x] T001 Create `internal/migrations/003_rate_limiting_and_config.sql` with tables `rate_limit_attempts` and `app_config` (see data-model.md)
- [x] T002 [P] Create `internal/migrations/004_login_logs_extended.sql` adding columns `ip_address TEXT` and `user_agent TEXT` to `login_logs`
- [x] T003 [P] Run `cd frontend && npm install marked` and commit updated `package.json` + `package-lock.json`

---

## Phase 2: Foundational — N+1 Query Fix + Helpers

**Purpose**: Core query performance fix. All list endpoints depend on these functions. Must complete before API standardization (Phase 5) to avoid touching the same files twice.

**⚠️ CRITICAL**: All handler work (Phases 3–12) benefits from this fix being in place first.

**Independent Test**: `go run ./cmd/medlog` + load /consultations with 20+ records; confirm single-digit query count in logs.

- [x] T004 Create helper `inClause(n int) string` in `internal/models/helpers.go` returning `(?,?,...)`
- [x] T005 [P] Refactor `consultationBase()` in `internal/models/consultation.go`: batch load professionals (`WHERE id IN`), batch load files (`WHERE consultation_id IN`), map results in memory — eliminate N+1
- [x] T006 [P] Refactor `FileFindByConsultationID()` in `internal/models/file.go`: batch load categories for all files via `fileLoadCategoriesBatch(ctx, db, fileIDs []string)` — eliminate N+1
- [x] T007 [P] Refactor `ProfessionalFindAll()` in `internal/models/professional.go`: batch load specialties for all professionals via single JOIN query with `WHERE professional_id IN` — eliminate N+1
- [x] T008 Add `slog` structured logging import to `internal/models/consultation.go`, `professional.go`, `file.go` — replace silenced `_` error assignments with `slog.Error(...)` calls

**Checkpoint**: All list queries use batch loading. Build passes: `go build ./...`

---

## Phase 3: US1 — Security Hardening (P1 Critical: #2, #3, #5, #6)

**Goal**: Rate limiting on login, CSP header, SESSION_SECRET rotation, remove credentials from repo.

**Independent Test**: 6 consecutive POST /api/auth/signin requests return 429 on 6th. Security headers present in any response. Old cmd directories gone from git.

- [x] T009 [US1] Implement `internal/middleware/ratelimit.go`: `RateLimit(db *sql.DB) func(http.Handler) http.Handler` — reads IP via `CF-Connecting-IP` → `X-Forwarded-For` (when `TRUST_PROXY=true` env) → `RemoteAddr`; queries `rate_limit_attempts`; blocks with 429 + `Retry-After` header after 5 attempts/minute; cleans expired rows on each check
- [x] T010 [US1] Add `TRUST_PROXY` env var reading in `cmd/medlog/main.go`; apply `RateLimit(database)` middleware scoped to `r.Post("/api/auth/signin", ...)` route only
- [x] T011 [P] [US1] Add `Content-Security-Policy` header in `internal/middleware/security.go`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'`
- [x] T012 [P] [US1] Implement `auth.EnsureSessionSecret(db *sql.DB, secret string) error` in `internal/auth/session.go`: SHA-256 hashes `secret`, compares against `app_config` table key `session_secret_hash`; if mismatch calls `InvalidateAllSessions(db)` then upserts new hash; if first run just inserts hash
- [x] T013 [US1] Call `auth.EnsureSessionSecret(database, sessionSecret)` in `cmd/medlog/main.go` before `auth.InitSessions()`; add `sessionSecret := mustEnv("SESSION_SECRET")` env read
- [x] T014 [P] [US1] Delete directory `cmd/migrate-mariadb/` entirely
- [x] T015 [P] [US1] Delete directory `cmd/sqlite-import/` if it exists (verify: `cmd/sqlite-import/main.go` exists)
- [x] T016 [US1] Remove `github.com/go-sql-driver/mysql` from `go.mod`/`go.sum` if no longer used after cmd removal: run `go mod tidy`

**Checkpoint**: `go build ./...` passes. Rate limit blocks 6th login attempt. `curl -I /health` shows CSP header.

---

## Phase 4: US2 — Docker & Config Paths (P1 Critical: #4)

**Goal**: Align all Docker config to `/app/data/` path base. Zero-downtime fix for `docker-compose.yml` users.

**Independent Test**: `docker compose up` with default env creates DB at `/app/data/db/medlog.sqlite` and uploads at `/app/data/uploads`.

- [x] T017 [US2] Update `docker-compose.yml`: volumes → `- ./data:/app/data`; env `DATABASE_URL: file:/app/data/db/medlog.sqlite`; env `FILES_PATH: /app/data/uploads`; remove `SESSION_SECURE` from docker-compose (belongs in .env only)
- [x] T018 [P] [US2] Update `.env.example`: `DATABASE_URL=file:/app/data/db/medlog.sqlite`; `FILES_PATH=/app/data/uploads`; add `TRUST_PROXY=false` entry with comment

**Checkpoint**: `docker compose config` shows `/app/data/` paths consistently.

---

## Phase 5: US3 — API Response Standardization + Single UPDATE (P2 High: #7, #9)

**Goal**: Every endpoint returns `{ data: T }`. ConsultationUpdate and UserUpdate use single SQL statement.

**Independent Test**: `curl -s http://localhost:3000/api/auth/me` returns `{"data":{...}}`. PATCH on consultation with one field sends single SQL UPDATE.

- [x] T019 [US3] Refactor `ConsultationUpdate()` in `internal/models/consultation.go`: build dynamic SET clause with `strings.Join`, execute single `UPDATE consultations SET ... WHERE id=?` — replace 6 independent ExecContext calls
- [x] T020 [P] [US3] Refactor `UserUpdate()` in `internal/models/user.go`: same pattern as T019 — single dynamic UPDATE replacing 4 independent ExecContext calls
- [x] T021 [US3] Update `internal/handlers/auth.go`: wrap `SignIn` response in `map[string]any{"data": ...}`, include `theme` field; wrap `Me` response in `map[string]any{"data": ...}`, include `theme`
- [x] T022 [P] [US3] Update `internal/handlers/consultations.go`: wrap `Create`, `Get`, `Update` responses in `{"data": ...}`
- [x] T023 [P] [US3] Update `internal/handlers/professionals.go`: wrap `Create`, `Get`, `Update` responses in `{"data": ...}`
- [x] T024 [P] [US3] Update `internal/handlers/clinics.go`: wrap `Create`, `Get`, `Update` responses in `{"data": ...}`
- [x] T025 [P] [US3] Update `internal/handlers/specialties.go`: wrap `Create`, `Update` responses in `{"data": ...}`
- [x] T026 [P] [US3] Update `internal/handlers/categories.go`: wrap `Create`, `Update` responses in `{"data": ...}`
- [x] T027 [P] [US3] Update `internal/handlers/users.go`: wrap `Create`, `Get`, `Update` responses in `{"data": ...}`
- [x] T028 [P] [US3] Update `internal/handlers/dashboard.go`: wrap `Get` response in `{"data": ...}`
- [x] T029 [P] [US3] Update `internal/handlers/files.go`: wrap `Upload` response in `{"data": ...}`
- [x] T030 [P] [US3] Update `internal/handlers/admin.go`: wrap `Stats` response in `{"data": ...}`
- [x] T031 [US3] Update `frontend/src/lib/api.ts`: change all `request<T>` type params for non-list endpoints to `request<{data: T}>` and add `.data` extraction; update `User` interface to include `theme: string`; update `signin`, `me`, `createConsultation`, `getConsultation`, `updateConsultation`, `createProfessional`, `getProfessional`, `updateProfessional`, `getDashboard`, `getAdminStats`, and all create/get/update for clinics/specialties/categories/users
- [x] T032 [P] [US3] Update `frontend/src/lib/auth.ts`: add `theme` to user store type; load `theme` from `/auth/me` response

**Checkpoint**: All API calls in browser network tab show `{"data": ...}` wrapper. Console has no undefined errors.

---

## Phase 6: US4 — Pagination (P2 High: #8)

**Goal**: All list endpoints support `?page=1&limit=20` with `{ data, total, page, limit }` response.

**Independent Test**: `GET /api/consultations?page=1&limit=2` returns max 2 items with `total` count.

- [x] T033 [US4] Add `parsePagination(r *http.Request) (page, limit int)` helper in `internal/handlers/helpers.go`: default page=1 limit=20, max limit=100
- [x] T034 [US4] Add `writePagedJSON(w, data, total, page, limit)` helper in `internal/handlers/helpers.go`
- [x] T035 [US4] Update `ConsultationFindByUserID`, `ConsultationFindAll` in `internal/models/consultation.go` to accept `limit, offset int`; add `ConsultationCountByUserID`, `ConsultationCountAll`
- [x] T036 [P] [US4] Update `ProfessionalFindAll` in `internal/models/professional.go` to accept `limit, offset int`; add `ProfessionalCount`
- [x] T037 [P] [US4] Update `FileFindAll` in `internal/models/file.go` to accept `limit, offset int`; add `FileCount`
- [x] T038 [US4] Update `internal/handlers/consultations.go` `List` handler: use `parsePagination`, call updated model funcs, respond with `writePagedJSON`
- [x] T039 [P] [US4] Update `internal/handlers/professionals.go` `List` handler: pagination
- [x] T040 [P] [US4] Update `internal/handlers/admin.go` `ListConsultations`, `ListProfessionals`, `ListFiles` handlers: pagination
- [x] T041 [US4] Add pagination controls to `frontend/src/routes/ConsultationList.svelte`: prev/next buttons + "page X of Y" label; update `getConsultations()` call with page state
- [x] T042 [P] [US4] Add pagination controls to `frontend/src/routes/ProfessionalList.svelte`
- [x] T043 [P] [US4] Add pagination controls to admin tabs in `frontend/src/routes/Admin.svelte` (consultations, professionals, files)

**Checkpoint**: Navigate to /consultations, see pagination controls. Page 2 loads different records.

---

## Phase 7: US5 — Logging + Bug Fixes + Password + Login Logs (P2 High: #10, #11, #12, #13, #15)

**Goal**: Structured logging at all error points, badge fix, password change endpoint, login logs admin view.

**Independent Test**: Backend logs show structured JSON/text on DB error. Badge in Reports shows blue for CONSULTATION. Admin panel has "Logs de Acesso" tab.

- [x] T044 [US5] Replace `log` with `log/slog` throughout all `internal/models/*.go`: add `slog.Error("op failed", "func", "...", "err", err)` before each `return nil, err`; add `slog.Warn(...)` for silenced `_` errors that are non-fatal
- [x] T045 [P] [US5] Replace `log` with `log/slog` in all `internal/handlers/*.go`: log real DB error before `writeError(w, "db error", ...)` calls
- [x] T046 [P] [US5] Fix `frontend/src/routes/Reports.svelte` line 91: change `c.type === 'CONSULTA'` to `c.type === 'CONSULTATION'`
- [x] T047 [P] [US5] Delete `frontend/src/lib/stores.ts`
- [x] T048 [US5] Add `UserMeUpdatePassword(w, r)` handler in `internal/handlers/users.go`: parse `{currentPassword, newPassword}`, verify current with bcrypt, validate newPassword ≥ 8 chars, hash with bcrypt, call `models.UserUpdatePassword`
- [x] T049 [P] [US5] Add route `PUT /api/users/me/password` in `cmd/medlog/main.go` inside `RequireAuth` group
- [x] T050 [P] [US5] Add `changePassword(currentPassword, newPassword)` to `frontend/src/lib/api.ts`
- [x] T051 [US5] Implement `models.LoginLogFindAll(ctx, db, limit, offset int) ([]LoginLog, int, error)` in `internal/models/login_log.go` (new file); define `LoginLog` struct with all fields including `IPAddress`, `UserAgent`
- [x] T052 [P] [US5] Update `internal/handlers/auth.go` `SignIn` to capture and store `ip_address` and `user_agent` in `login_logs` INSERT
- [x] T053 [P] [US5] Add `ListLoginLogs` handler in `internal/handlers/admin.go`: paginated `GET /api/admin/login-logs`
- [x] T054 [US5] Add route `GET /api/admin/login-logs` in `cmd/medlog/main.go` inside `RequireAdmin` group
- [x] T055 [US5] Add "Logs de Acesso" tab to `frontend/src/routes/Admin.svelte`: table with columns user_email, user_name, ip_address, timestamp; pagination controls; call `getAdminLoginLogs(page)`
- [x] T056 [P] [US5] Add `getAdminLoginLogs(page)` to `frontend/src/lib/api.ts`

**Checkpoint**: Visit /reports — CONSULTATION badge is blue. Admin panel shows "Logs de Acesso" tab with data.

---

## Phase 8: US6 — Tema Claro/Escuro (P2 High: #14)

**Goal**: Users can switch between light, dark, and system theme. Preference persists across sessions.

**Independent Test**: Toggle theme in Navigation → UI switches immediately → refresh page → theme persists (loaded from session user data).

- [x] T057 [US6] Add CSS custom properties to `frontend/src/app.css`: define `--bg`, `--bg-surface`, `--bg-elevated`, `--border`, `--text`, `--text-muted`, `--accent` for `[data-theme="dark"]` (current values) and `[data-theme="light"]` (new light values); add `@media (prefers-color-scheme: light)` block for SYSTEM default
- [x] T058 [US6] Add `UserMeUpdateTheme(w, r)` handler in `internal/handlers/users.go`: parse `{theme}`, validate against `LIGHT|DARK|SYSTEM`, call `models.UserUpdate` with theme field, return `{"data": user}`
- [x] T059 [P] [US6] Add route `PATCH /api/users/me/theme` in `cmd/medlog/main.go` inside `RequireAuth` group
- [x] T060 [P] [US6] Add `updateTheme(theme: string)` to `frontend/src/lib/api.ts`
- [x] T061 [US6] Update `frontend/src/lib/auth.ts`: add `theme` to user store state; expose `setTheme(t: string)` action that optimistically sets store theme + calls `api.updateTheme()` in background
- [x] T062 [US6] Update `frontend/src/App.svelte`: add `$effect` that reads `user.theme` from auth store and calls `document.documentElement.setAttribute('data-theme', resolvedTheme)` where SYSTEM resolves via `window.matchMedia`
- [x] T063 [US6] Add theme toggle button to `frontend/src/components/Navigation.svelte`: sun/moon icon cycling LIGHT → DARK → SYSTEM; calls `auth.setTheme()`; shows current theme icon

**Checkpoint**: Toggle button in nav switches theme immediately. Logout + login restores saved theme.

---

## Phase 9: US7 — Integration Tests (P3 Medium: #16)

**Goal**: Go integration tests for models and handlers using SQLite `:memory:`.

**Independent Test**: `go test ./...` passes with green output.

- [x] T064 [US7] Create `internal/db/testhelper.go`: `SetupTestDB(t *testing.T) *sql.DB` that opens `:memory:`, runs goose migrations, registers `t.Cleanup(db.Close)`
- [x] T065 [P] [US7] Create `internal/models/consultation_test.go`: `TestConsultationCreate`, `TestConsultationFindByID`, `TestConsultationUpdate`, `TestConsultationDelete`
- [x] T066 [P] [US7] Create `internal/models/professional_test.go`: `TestProfessionalCreate`, `TestProfessionalFindAll_BatchSpecialties`
- [x] T067 [P] [US7] Create `internal/models/user_test.go`: `TestUserCreate`, `TestUserUpdate_SingleSQL`
- [x] T068 [US7] Create `internal/handlers/auth_test.go`: `TestSignIn_Success`, `TestSignIn_InvalidCredentials`, `TestSignIn_RateLimit` using `httptest.NewRecorder()` + `httptest.NewRequest()`
- [x] T069 [P] [US7] Create `internal/handlers/consultations_test.go`: `TestConsultationList_Pagination`, `TestConsultationCreate_Handler`
- [x] T070 [P] [US7] Create `internal/handlers/professionals_test.go`: `TestProfessionalList_NoPlusOne`

**Checkpoint**: `go test ./... -v` shows all tests PASS.

---

## Phase 10: US8 — Phones CRUD (P3 Medium: #17)

**Goal**: Users can add/edit/delete phone numbers for their professionals and clinics.

**Independent Test**: POST /api/professionals/{id}/phones → 200 with phone data. GET returns it. DELETE removes it.

- [x] T071 [US8] Create `internal/models/phone.go`: `Phone` struct; `PhoneFindByProfessionalID`, `PhoneFindByClinicID`, `PhoneCreate`, `PhoneUpdate`, `PhoneDelete` functions
- [x] T072 [US8] Create `internal/handlers/phones.go`: `PhoneHandler` struct with `DB`; handlers `ListByProfessional`, `ListByClinic`, `Create`, `Update`, `Delete` — scope create/update/delete to owner via professional/clinic `user_id` check (non-admin) or allow all (admin)
- [x] T073 [US8] Register phone routes in `cmd/medlog/main.go` inside `RequireAuth` group: `GET /professionals/{id}/phones`, `POST /professionals/{id}/phones`, `GET /clinics/{id}/phones`, `POST /clinics/{id}/phones`, `PUT /phones/{id}`, `DELETE /phones/{id}`
- [x] T074 [US8] Add phone API functions to `frontend/src/lib/api.ts`: `getPhones(professionalId)`, `createPhone(professionalId, data)`, `updatePhone(id, data)`, `deletePhone(id)`; add `Phone` interface
- [x] T075 [US8] Add phones section to `frontend/src/routes/ProfessionalDetail.svelte`: list phones, inline add form (number + label), delete button per phone

**Checkpoint**: Open professional detail → phones section visible → add phone → appears in list.

---

## Phase 11: US9 — User Sharing (P3 Medium: #18, #19)

**Goal**: User A can share their professional/clinic dictionaries (read-only) with user B.

**Independent Test**: User A shares professionals with B → B's GET /professionals includes A's professionals (read-only, not editable by B).

- [ ] T076 [US9] Create `internal/models/sharing.go`: `Sharing` struct; `ProfessionalSharingCreate`, `ProfessionalSharingDelete`, `ProfessionalSharingFindByUser`; same for clinics; function `ProfessionalSharedWithUser(ctx, db, userID) ([]string, error)` returning shared-from user IDs
- [ ] T077 [US9] Modify `ProfessionalFindAll()` in `internal/models/professional.go`: when not admin, also fetch professionals from users who shared with `userID` (via `user_professional_sharing`); mark shared professionals as read-only (add `IsShared bool` field to `Professional` struct)
- [ ] T078 [P] [US9] Modify `ClinicFindAll()` equivalent in `internal/models/clinic.go`: same pattern — include clinics from sharing users; add `IsShared bool` to `Clinic` struct
- [ ] T079 [US9] Create `internal/handlers/sharing.go`: `SharingHandler`; handlers `ListProfessionalSharing`, `CreateProfessionalSharing`, `DeleteProfessionalSharing`, `ListClinicSharing`, `CreateClinicSharing`, `DeleteClinicSharing`
- [ ] T080 [US9] Register sharing routes in `cmd/medlog/main.go` inside `RequireAuth` group: `GET/POST /sharing/professionals`, `DELETE /sharing/professionals/{userId}`, `GET/POST /sharing/clinics`, `DELETE /sharing/clinics/{userId}`
- [ ] T081 [US9] Add sharing API functions to `frontend/src/lib/api.ts`: `getProfessionalSharing()`, `createProfessionalSharing(targetUserId)`, `deleteProfessionalSharing(userId)`, same for clinics; add `Sharing` interface
- [ ] T082 [US9] Add `IsShared` field to `Professional` and `Clinic` interfaces in `frontend/src/lib/api.ts`; show "(compartilhado)" label next to shared items in `ProfessionalList.svelte`; prevent edit/delete actions on shared items
- [ ] T083 [US9] Create sharing management UI in `frontend/src/routes/Admin.svelte` or new page: list users, toggle sharing on/off per user; or add to user profile settings

**Checkpoint**: Log in as user A, share professionals with B. Log in as B — A's professionals appear as read-only.

---

## Phase 12: US10 — UX Improvements + Markdown (P3–P4: #20, #21, #22, #27, #28, #30)

**Goal**: Better markdown rendering, inline professional creation, dashboard cache, minor UX fixes.

**Independent Test**: Consultation notes with `**bold**`, lists, headers render correctly. ConsultationNew form resets after create.

- [ ] T084 [US10] Replace `renderMarkdown()` in `frontend/src/components/MarkdownPreview.svelte` with `marked.parse(content)` from `marked` library; remove old regex implementation; add `marked` import
- [ ] T085 [P] [US10] Add inline professional creation to `frontend/src/routes/ConsultationNew.svelte`: add `InlineCreate` component instance for professional (using existing `InlineCreate` pattern from clinics/specialties); call `createProfessional({name, isActive: true, specialtyIds: []})` on submit
- [ ] T086 [P] [US10] Reset form fields in `frontend/src/routes/ConsultationNew.svelte` after successful consultation create: set date, type, proposito, notes, professionalId, rating back to defaults
- [ ] T087 [P] [US10] Add text search input to `frontend/src/routes/ProfessionalList.svelte`: client-side filter on `name` field (list already loaded); input bound to `searchQuery` state; filter applied via `$derived`
- [ ] T088 [P] [US10] Update `InlineCreate.svelte` to accept optional `showAddress: boolean` prop; when true, show address input field; pass address in create call
- [ ] T089 [P] [US10] Pass `showAddress={true}` to clinic InlineCreate in `ProfessionalDetail.svelte` (professional registration form)
- [ ] T090 [US10] Add in-memory dashboard cache to `internal/handlers/dashboard.go`: `var cache struct { data any; at time.Time; mu sync.Mutex }` — serve cached if `time.Since(at) < 5*time.Minute`; invalidate on any write not needed (TTL sufficient for this use case)

**Checkpoint**: Open markdown notes with bold/italic/lists — renders correctly. Create consultation → form clears. Search professionals by name works.

---

## Phase 13: Polish & Low Priority (#23, #24, #25, #26, #29)

**Purpose**: Low-priority improvements and cleanup.

- [ ] T091 [P] Add `Cache-Control: private, max-age=3600` header in `internal/handlers/files.go` `Serve` handler before calling `http.ServeContent`
- [ ] T092 [P] Remove duplicate `migrations/` root directory (keep only `internal/migrations/` as source of truth) — or add `migrations/` to `.gitignore` if it must remain for tooling
- [ ] T093 [P] Add `signal: AbortSignal.timeout(30000)` to `request()` helper in `frontend/src/lib/api.ts`; catch `TimeoutError` and throw `new Error('Servidor indisponível')` for user-friendly message
- [ ] T094 Add `Cache-Control` and offline timeout documentation to `docs/` or update `TECHNICAL.md` with new env vars (`TRUST_PROXY`, `SESSION_SECURE`)
- [ ] T095 Run `cd frontend && npm run build` to verify frontend compiles cleanly with all changes; check `dist/` output size for bundle regression

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001, T002, T003 all parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 (migrations must exist before testing); T005/T006/T007/T008 parallel after T004
- **Phase 3 (US1 Security)**: Depends on Phase 1 (migration 002 for rate_limit_attempts + app_config); T014/T015/T016 parallel after T013
- **Phase 4 (US2 Docker)**: Independent — can run in parallel with Phase 3
- **Phase 5 (US3 API Std.)**: Depends on Phase 2 completion (don't touch handlers before queries are fixed); T019–T030 mostly parallel; T031–T032 after all backend handlers updated
- **Phase 6 (US4 Pagination)**: Depends on Phase 5 (response format must be stable); T033→T034→T035 then T036–T040 parallel, then T041–T043 parallel
- **Phase 7 (US5 Fixes)**: Depends on Phase 5 (handlers updated); T044–T056 mostly parallel
- **Phase 8 (US6 Theme)**: Depends on Phase 5 (auth response includes theme); T057–T063 mostly sequential
- **Phase 9 (US7 Tests)**: Depends on Phases 2–8 (tests validate final behavior); T064 first, then T065–T070 parallel
- **Phase 10 (US8 Phones)**: Depends on Phase 2 (models established); T071→T072→T073, then T074→T075
- **Phase 11 (US9 Sharing)**: Depends on Phases 5+10 (Professional model extended); T076→T077/T078 parallel→T079→T080→T081→T082→T083
- **Phase 12 (US10 UX)**: Depends on Phase 3 (npm install marked done); T084–T090 mostly parallel
- **Phase 13 (Polish)**: Depends on all prior phases; T091–T095 all parallel

### Parallel Opportunities Per Phase

```
Phase 1:   T001 ║ T002 ║ T003
Phase 2:   T004 → (T005 ║ T006 ║ T007 ║ T008)
Phase 3:   T009 → T010 → (T011 ║ T012) → T013 → (T014 ║ T015) → T016
Phase 4:   T017 ║ T018
Phase 5:   T019 ║ T020 → (T021 ║ T022 ║ T023 ║ T024 ║ T025 ║ T026 ║ T027 ║ T028 ║ T029 ║ T030) → T031 → T032
Phase 6:   T033 → T034 → T035 → (T036 ║ T037) → (T038 ║ T039 ║ T040) → (T041 ║ T042 ║ T043)
Phase 7:   (T044 ║ T045 ║ T046 ║ T047 ║ T048) → (T049 ║ T050) → T051 → (T052 ║ T053) → T054 → T055 → T056
Phase 8:   T057 → T058 → (T059 ║ T060) → T061 → T062 → T063
Phase 9:   T064 → (T065 ║ T066 ║ T067) → T068 → (T069 ║ T070)
Phase 10:  T071 → T072 → T073 → T074 → T075
Phase 11:  T076 → (T077 ║ T078) → T079 → T080 → T081 → T082 → T083
Phase 12:  T084 ║ T085 ║ T086 ║ T087 ║ T088 ║ T089 ║ T090
Phase 13:  T091 ║ T092 ║ T093 ║ T094 ║ T095
```

---

## Implementation Strategy

### MVP Scope (Critical Only — Phases 1–4)

1. Phase 1: Setup migrations + marked install
2. Phase 2: N+1 fix (foundational)
3. Phase 3: Security hardening (rate limit, CSP, SESSION_SECRET, rm cmds)
4. Phase 4: Docker paths
5. **STOP**: Deploy and validate on Unraid. All critical issues resolved.

### Full Delivery Sequence

1. MVP (Phases 1–4) → deploy
2. Phase 5–6 (API + Pagination) → deploy (breaking change: update frontend too)
3. Phase 7–8 (Logging + Theme) → deploy
4. Phase 9 (Tests) → CI validation
5. Phase 10–12 (New features) → deploy
6. Phase 13 (Polish) → deploy

---

## Summary

| Phase | User Story | Items | Tasks | Effort |
|-------|-----------|-------|-------|--------|
| 1 | Setup | — | T001–T003 | 30min |
| 2 | Foundational (N+1) | #1 | T004–T008 | 4h |
| 3 | US1 Security | #2,#3,#5,#6 | T009–T016 | 3.5h |
| 4 | US2 Docker | #4 | T017–T018 | 30min |
| 5 | US3 API Std. | #7,#9 | T019–T032 | 4h |
| 6 | US4 Pagination | #8 | T033–T043 | 4h |
| 7 | US5 Fixes+Logs | #10,#11,#12,#13,#15 | T044–T056 | 5h |
| 8 | US6 Theme | #14 | T057–T063 | 4h |
| 9 | US7 Tests | #16 | T064–T070 | 7h |
| 10 | US8 Phones | #17 | T071–T075 | 4h |
| 11 | US9 Sharing | #18,#19 | T076–T083 | 6h |
| 12 | US10 UX | #20–#22,#27,#28,#30 | T084–T090 | 5h |
| 13 | Polish | #23–#26,#29 | T091–T095 | 2h |
| **Total** | | **30 items** | **95 tasks** | **~49h** |

---

## Notes

- No TDD: test tasks (Phase 9) are a deliverable, not prerequisites for implementation
- Commit after each phase checkpoint
- Phase 5 is a breaking change — backend and frontend MUST be updated together in same commit
- Sharing (Phase 11) adds `IsShared` field to Professional/Clinic — ensure frontend handles gracefully before Phase 11
- `go mod tidy` after T016 to clean up mysql driver dependency
