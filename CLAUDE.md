# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MedLog is a self-hosted medical consultation tracking system designed for families to maintain private medical records. The core entity is the **Consultation** (medical appointment), which connects Users, Professionals, and Files (documents/images).

**Tech Stack:** Go 1.24 (backend), Svelte 5 + Vite 5 (frontend), SQLite via modernc.org/sqlite, alexedwards/scs v2 (sessions), pressly/goose v3 (migrations), go-chi/chi v5 (router)

## Development Commands

```bash
# Backend
go run ./cmd/medlog           # Start backend on :3000
go build ./...                # Build check
go test ./...                 # Run tests

# Frontend (hot reload dev)
cd frontend && npm run dev    # Starts on :5173, proxies /api to :3000
cd frontend && npm run build  # Build to internal/embed/dist/

# Docker
docker build -t medlog:v2 .
docker compose up

# Generate session secret
openssl rand -base64 32
```

## Architecture

### Data Model
- **User**: Users of the system (ADMIN or USER role)
- **Professional**: Healthcare professionals with active/inactive status, multiple specialties, and optional clinic association; scoped to a user (user_id)
- **Specialty**: Medical specialties dictionary (e.g., Cardiologia, Ortopedia)
- **ProfessionalSpecialty**: N:N junction table linking professionals to specialties
- **Clinic**: Clinics/hospitals dictionary (e.g., Hospital Particular, UBS); scoped to a user (user_id)
- **Consultation**: Central entity linking User + Professional + date + notes (Markdown) + Files
- **File**: Uploaded documents (PDF) and images (PNG/JPG) with categorization
- **FileCategory**: File category dictionary (e.g., Laudo, Receita, Pedido de Exame)

Key relationships:
- User → Consultations (1:N)
- Professional → Consultations (1:N)
- Professional ↔ Specialty (N:N via ProfessionalSpecialty)
- Professional → Clinic (N:1, optional)
- Consultation → Files (1:N)
- FileCategory → Files (1:N)
- Professional → Files (1:N) - for filtering files by professional

### Authentication
- Credentials-based authentication (email/password with bcrypt)
- Server-side sessions stored in SQLite via alexedwards/scs v2
- User roles: ADMIN and USER
- Auth middleware: `internal/auth/middleware.go`
- Session manager: `internal/auth/session.go`

### File Upload System
- Upload directory: `FILES_PATH` env var or `./data/uploads`
- Allowed types: PDF, PNG, JPG (max 10MB per file)
- Unique filenames: `{uuid}.{extension}`
- Access via: `/api/files/{filename}`

### Project Structure
```
cmd/medlog/main.go              # Entry point
internal/
  auth/session.go               # SCS session manager
  auth/middleware.go            # RequireAuth, RequireAdmin
  db/db.go                      # sql.Open + WAL PRAGMA
  db/migrate.go                 # goose migrations at startup
  handlers/                     # HTTP handlers (auth, consultations, etc.)
  middleware/security.go        # Security headers
  models/                       # SQL query functions (no ORM)
  embed/                        # Embedded Svelte build output
  migrations/                   # SQL migration files (embedded)
migrations/                     # SQL migration files (source)
frontend/                       # Svelte 5 SPA
  src/lib/api.ts                # Typed API client
  src/lib/auth.ts               # Auth stores
  src/routes/                   # Page components
  src/components/               # Shared components
```

## Key Patterns

1. **Professional Status**: Only `is_active = true` professionals appear in selection lists for new consultations. Inactive professionals remain in history but cannot be selected.

2. **Quick Professional Creation**: Forms for creating consultations allow inline creation of professionals without full details.

3. **Multiple Specialties**: Professionals can have multiple specialties via N:N relationship. Inline creation of new specialties is supported during professional registration.

4. **File Categorization**: Files must be categorized when uploaded (e.g., Laudo, Receita). Inline creation of new categories is supported during file upload.

5. **Controlled Dictionaries**: Both file categories and medical specialties are managed through controlled dictionaries in the admin panel.

6. **File Associations**: Files belong to both a Consultation and a Professional (for filtering), plus a FileCategory for organization.

7. **Markdown Support**: Consultation notes support Markdown formatting.

8. **Cascade Deletes**: Deleting a user cascades to their consultations; deleting a consultation cascades to its files. Professional-Specialty associations cascade on delete.

9. **Referential Integrity**: Dictionaries (categories, specialties) cannot be deleted if in use. Professionals cannot be bulk-deleted if they have consultations.

10. **Admin Panel Organization**: Admin panel has tabs for:
    - Users: Full CRUD for system users
    - Consultations: View all + bulk delete
    - Professionals: View all + bulk delete (with validation)
    - Specialties: Full CRUD for specialty dictionary
    - Categories: Full CRUD for file category dictionary
    - Clinics: Full CRUD for clinic/hospital dictionary
    - Files: View all files with metadata

11. **Clinic Association**: Professionals can optionally be associated with a clinic/hospital from a controlled dictionary. Inline creation is supported during professional registration.

12. **No ORM**: All database access uses raw SQL via `database/sql`. Query functions live in `internal/models/`.

13. **User-scoped Data**: Professionals and Clinics have a `user_id` column so each user manages their own data.

## Environment Variables

Required in `.env`:
```
DATABASE_URL=file:./data/medlog.sqlite
FILES_PATH=./data/uploads
SESSION_SECRET=<generate with: openssl rand -base64 32>
PORT=3000
ADMIN_EMAIL=admin@example.com    # First-boot only
ADMIN_PASSWORD=changeme          # First-boot only
SESSION_SECURE=false             # true in production (HTTPS)
TRUST_PROXY=false                # true if behind reverse proxy (enables X-Forwarded-For for rate limiting)
```

## Docker Deployment

The project is designed for Docker deployment (e.g., Unraid):
- Dockerfile builds a single Go binary with embedded Svelte assets
- Volume mount required for `FILES_PATH` and the SQLite database directory
- No external database required — SQLite is embedded
- Build command: `docker build -t medlog:v2 .`
