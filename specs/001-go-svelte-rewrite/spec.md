# Feature Specification: Complete Stack Rewrite

**Feature Branch**: `001-go-svelte-rewrite`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "Refatorar todo o projeto em relação ao stack tecnológico, adotando Go (backend) e Svelte (frontend) conforme relatório STACK_COMPARATIVO.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single-Container Deployment (Priority: P1)

A self-hoster deploys MedLog on Unraid (or any Docker-compatible host) using a single `docker run` command or `docker-compose.yml` with one service — no external database, no companion containers.

**Why this priority**: Eliminates the biggest operational burden (maintaining a separate MariaDB service). Single file = single backup. The entire system state is one `.sqlite` file on a volume mount.

**Independent Test**: `docker run -p 3000:3000 -v /mnt/appdata/medlog:/data medlog:v2` — system starts, login page appears, all features work.

**Acceptance Scenarios**:

1. **Given** a fresh host with Docker, **When** the image is pulled and run with a single volume mount, **Then** the system starts in under 2 seconds, migration runs automatically, and login page is accessible.
2. **Given** a running instance with data, **When** the host reboots, **Then** all data persists after the container restarts because it is stored in the mounted volume.
3. **Given** a running instance, **When** the admin downloads a backup, **Then** it is a single `.sqlite` file that can be used to restore the full system on a new host.

---

### User Story 2 - Preserved Feature Parity (Priority: P1)

Existing users continue to use all current MedLog features without any loss of functionality or data.

**Why this priority**: A rewrite that breaks existing workflows has no value. Feature parity is the baseline for the migration to be considered successful.

**Independent Test**: An existing MedLog database exported from the current version can be imported and all records are accessible and editable.

**Acceptance Scenarios**:

1. **Given** a migrated instance, **When** a user logs in, **Then** they can create, view, edit, and delete consultations with associated files and notes.
2. **Given** a migrated instance, **When** a user uploads a PDF or image to a consultation, **Then** the file is stored, categorized, and retrievable.
3. **Given** a migrated instance, **When** an admin opens the admin panel, **Then** all 7 tabs (Users, Consultations, Professionals, Specialties, Categories, Clinics, Files) are functional.
4. **Given** a migrated instance, **When** an admin creates a new user, **Then** the user can sign in with credentials and access their own consultations only.
5. **Given** a professional marked as inactive, **When** a user opens the new consultation form, **Then** that professional does not appear in the selection list.

---

### User Story 3 - Fast and Responsive Interface (Priority: P2)

Users experience a noticeably faster interface with smaller asset downloads on first load.

**Why this priority**: The new frontend framework produces smaller JavaScript bundles. Users on slow home networks (Unraid is often on home broadband) benefit from faster initial load.

**Independent Test**: Navigate to the app on a fresh browser (no cache). All pages load and are interactive before 2 seconds on a local network.

**Acceptance Scenarios**:

1. **Given** a cold browser session, **When** the app loads for the first time, **Then** the interface is fully interactive in under 2 seconds on a local network.
2. **Given** a low-powered home server (e.g., Raspberry Pi 5 or similar ARM SBC), **When** the container starts, **Then** it is ready to serve requests in under 3 seconds.

---

### User Story 4 - Database Backup and Restore (Priority: P2)

Admins can back up the database from the UI and restore it from a file, with no risk of data corruption during the operation.

**Why this priority**: Backup/restore was a known problem area in the previous SQLite migration attempt. The new implementation must solve the WAL checkpointing and connection teardown correctly.

**Independent Test**: Admin clicks Backup → downloads `.sqlite` file → stops the container → replaces the volume file → starts the container → all data from the backup is present.

**Acceptance Scenarios**:

1. **Given** a running instance, **When** admin triggers backup, **Then** a valid, complete `.sqlite` file is downloaded (WAL checkpointed before download).
2. **Given** a running instance, **When** admin uploads a `.sqlite` file to restore, **Then** the system switches to the restored database without a container restart and without 502 errors.
3. **Given** a user is logged in when a restore happens, **When** the restore completes, **Then** the user's session is gracefully invalidated and they are prompted to log in again.

---

### Edge Cases

- What happens when the SQLite file is on a read-only filesystem? System should fail loudly at startup with a clear error, not silently corrupt.
- How does the system handle concurrent write requests (e.g., two users uploading files at the same time)? SQLite WAL mode handles this — requests queue, none fail silently.
- What happens if an uploaded file exceeds the 10 MB limit? The system rejects it before writing to disk with a clear error message.
- What happens during restore if the uploaded file is not a valid SQLite database? System validates the file before replacing the live database.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Authorization**

- **FR-000**: On first boot, if no users exist in the database and `ADMIN_EMAIL` + `ADMIN_PASSWORD` environment variables are set, the system MUST automatically create an admin user. If the variables are absent on first boot, startup MUST fail with a clear error message.
- **FR-001**: System MUST authenticate users via email/password credentials stored in the database.
- **FR-001a**: Sessions MUST be stored server-side in the SQLite database. On backup restore, ALL active sessions MUST be invalidated so users are forced to re-authenticate against the restored database.
- **FR-002**: System MUST support two user roles: ADMIN (full access) and USER (own records only).
- **FR-003**: Unauthenticated requests to any page or API endpoint MUST be redirected to the sign-in page.
- **FR-004**: Admins MUST be able to create, edit, deactivate, and delete user accounts.

**Consultations**

- **FR-005**: Users MUST be able to create consultations linked to a professional, with a date, type (Consultation or Event), and optional Markdown notes.
- **FR-006**: Users MUST be able to attach multiple files (PDF, PNG, JPG ≤ 10 MB each) to a consultation, each with a category.
- **FR-007**: Users MUST be able to view, edit, and delete their own consultations.
- **FR-008**: Deleting a consultation MUST cascade-delete all associated files (stored file and database record).

**Professionals**

- **FR-009**: Users MUST be able to create and manage professionals with name, notes, active/inactive status, one or more specialties, and optional clinic.
- **FR-010**: Only active professionals MUST appear in the selection list when creating a new consultation.
- **FR-011**: Professionals with existing consultations MUST NOT be deletable via bulk delete.

**Controlled Dictionaries (Specialties, File Categories, Clinics)**

- **FR-012**: Admins MUST be able to create, rename, and delete entries in each dictionary (Specialties, File Categories, Clinics).
- **FR-013**: Dictionary entries referenced by existing records MUST NOT be deletable.
- **FR-014**: Users MUST be able to create new dictionary entries inline while filling consultation or professional forms.

**File Management**

- **FR-015**: Uploaded files MUST be stored outside the container image in a configurable directory (volume mount).
- **FR-016**: Files MUST be accessible only to authenticated users.
- **FR-017**: File records MUST retain association to both the consultation and the professional.

**Admin Panel**

- **FR-018**: Admins MUST have access to a panel with views for: Users, all Consultations, all Professionals, Specialties, File Categories, Clinics, and all Files.
- **FR-019**: Admins MUST be able to bulk-delete consultations and professionals (with referential integrity checks).
- **FR-020**: Admins MUST be able to trigger a database backup download and upload a database file for restore.

**Deployment & Observability**

- **FR-021**: The system MUST run as a single Docker container with no external service dependencies at runtime.
- **FR-022**: The SQLite database file MUST be stored at a configurable path (environment variable) on a mounted volume.
- **FR-023**: On container start, the system MUST automatically apply any pending database schema migrations.
- **FR-024**: The system MUST expose `GET /health` returning `{"status":"ok"}` with HTTP 200 when the SQLite database is reachable, and HTTP 503 otherwise. The Dockerfile MUST include a `HEALTHCHECK` directive pointing to this endpoint.

### Key Entities

- **User**: Email, hashed password, name, role (ADMIN/USER), theme preference.
- **Consultation**: Date, type, Markdown notes, linked user, linked professional, set of files.
- **Professional**: Name, notes, active status, linked specialties (N:N), optional clinic.
- **File**: Stored filename, original name, MIME type, linked consultation, linked professional, linked category.
- **Specialty / FileCategory / Clinic**: Name-only dictionary entries, referenced by other entities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Docker image size is under 30 MB (compared to ~400–600 MB today).
- **SC-002**: Container starts and is ready to serve HTTP requests in under 3 seconds on a 2-core ARM processor.
- **SC-003**: All 20 functional requirements above pass manual acceptance testing before release.
- **SC-004**: The system operates correctly with a database file from the current SQLite-migrated version (zero data loss on migration).
- **SC-005**: Frontend initial load (uncached) delivers under 150 KB of compressed JavaScript assets.
- **SC-006**: `docker-compose.yml` requires only one service definition (no external database service).
- **SC-007**: Backup download and restore operations complete without container restart and without HTTP 5xx errors.
- **SC-008**: After a restore operation, all active user sessions are invalidated; users who attempt further actions are redirected to sign-in.
- **SC-009**: `GET /health` responds in under 100ms under normal operating conditions.

## Assumptions

- SQLite migration (MariaDB → SQLite) is **already complete** as of 2026-04-24. The new stack retains SQLite; no data migration from MariaDB is needed.
- Multi-user support (multiple family members) is a hard requirement — single-user architecture is out of scope.
- The deployment target remains Docker / Unraid. Native binary deployment is out of scope for v2.
- The existing `.sqlite` database file path (`/data/db/medlog.sqlite` on the volume) is preserved so existing deployments can upgrade in-place.
- File uploads continue to be stored on the filesystem (not in the database). Cloud storage integration is out of scope.
- The Svelte frontend will be served as a SPA by the Go backend — no SSR is required.
- Authentication will use server-side sessions stored in the SQLite database, without an external auth provider. Sessions are fully invalidated when a backup restore completes.
- The `distroless/static` base image requires a fully statically compiled Go binary (CGO disabled or bundled).
- Rich text editing (TipTap or similar) is out of scope; Markdown textarea is preserved.
- The existing URL structure (`/consultations`, `/professionals`, `/admin`, etc.) should be preserved where possible for bookmark compatibility.
- On a fresh deployment, the first admin user is created automatically if `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables are present at startup.

## Clarifications

### Session 2026-05-15

- Q: Authentication session model → A: Server-side sessions stored in SQLite (Option A). Sessions invalidated on restore.
- Q: Initial admin user setup → A: Env vars on first boot (`ADMIN_EMAIL` + `ADMIN_PASSWORD`); startup fails if absent and no users exist (Option A).
- Q: Health check endpoint → A: `GET /health` with SQLite reachability check; 200 ok / 503 error; Dockerfile HEALTHCHECK directive required (Option A).
