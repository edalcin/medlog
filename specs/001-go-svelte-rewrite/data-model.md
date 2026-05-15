# Data Model: MedLog v2

## Schema Overview

All tables use TEXT primary keys (UUID v4). The schema is forward-compatible with the existing Prisma-migrated SQLite database — all `CREATE TABLE` statements use `IF NOT EXISTS` for safe in-place upgrades (see research.md Q2).

---

## Tables

### users

```sql
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    password   TEXT NOT NULL,           -- bcrypt hash
    name       TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'USER',    -- 'ADMIN' | 'USER'
    theme      TEXT NOT NULL DEFAULT 'SYSTEM',  -- 'LIGHT' | 'DARK' | 'SYSTEM'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Validation rules:**
- `email` must be unique (UNIQUE constraint)
- `role` must be 'ADMIN' or 'USER' (validated in application layer)
- `password` stored as bcrypt hash, never plaintext

---

### sessions

**New table** — does not exist in Prisma schema. Created by migration 002.

```sql
CREATE TABLE IF NOT EXISTS sessions (
    token  TEXT PRIMARY KEY,
    data   BLOB NOT NULL,
    expiry REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expiry);
```

**Notes:**
- Managed entirely by `alexedwards/scs` + `sqlite3store`
- On backup restore: `DELETE FROM sessions` invalidates all active sessions (FR-001a)
- `data` is SCS-encoded session payload (user ID, role, etc.)

---

### professionals

```sql
CREATE TABLE IF NOT EXISTS professionals (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    notes      TEXT,
    is_active  INTEGER NOT NULL DEFAULT 1,   -- 1=active, 0=inactive
    clinic_id  TEXT REFERENCES clinics(id) ON DELETE SET NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**State transitions:** `is_active` 1→0 (deactivate) or 0→1 (reactivate). Inactive professionals are excluded from new-consultation selection (FR-010).

---

### professional_specialties

Junction table for N:N relationship between professionals and specialties.

```sql
CREATE TABLE IF NOT EXISTS professional_specialties (
    professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    specialty_id    TEXT NOT NULL REFERENCES specialties(id)   ON DELETE CASCADE,
    PRIMARY KEY (professional_id, specialty_id)
);
```

---

### specialties

```sql
CREATE TABLE IF NOT EXISTS specialties (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Referential integrity:** Cannot be deleted if referenced by `professional_specialties` (FR-013).

---

### clinics

```sql
CREATE TABLE IF NOT EXISTS clinics (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Referential integrity:** Cannot be deleted if referenced by `professionals.clinic_id` (FR-013).

---

### consultations

```sql
CREATE TABLE IF NOT EXISTS consultations (
    id              TEXT PRIMARY KEY,
    date            DATETIME NOT NULL,
    type            TEXT NOT NULL DEFAULT 'CONSULTATION',  -- 'CONSULTATION' | 'EVENT'
    notes           TEXT,
    user_id         TEXT NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
    professional_id TEXT NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS consultations_user_id_idx        ON consultations(user_id);
CREATE INDEX IF NOT EXISTS consultations_professional_id_idx ON consultations(professional_id);
CREATE INDEX IF NOT EXISTS consultations_date_idx           ON consultations(date DESC);
```

**Notes:**
- `ON DELETE CASCADE` from `users` — deleting a user deletes their consultations (FR-008)
- `ON DELETE RESTRICT` from `professionals` — professionals with consultations cannot be deleted (FR-011)

---

### file_categories

```sql
CREATE TABLE IF NOT EXISTS file_categories (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Referential integrity:** Cannot be deleted if referenced by `files.category_id` (FR-013).

---

### files

```sql
CREATE TABLE IF NOT EXISTS files (
    id              TEXT PRIMARY KEY,
    filename        TEXT NOT NULL UNIQUE,    -- UUID-based stored filename
    original_name   TEXT NOT NULL,           -- user's original filename
    mime_type       TEXT NOT NULL,           -- 'application/pdf' | 'image/png' | 'image/jpeg'
    size            INTEGER NOT NULL,        -- bytes
    consultation_id TEXT NOT NULL REFERENCES consultations(id)   ON DELETE CASCADE,
    professional_id TEXT          REFERENCES professionals(id)   ON DELETE SET NULL,
    category_id     TEXT          REFERENCES file_categories(id) ON DELETE SET NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS files_consultation_id_idx ON files(consultation_id);
CREATE INDEX IF NOT EXISTS files_professional_id_idx ON files(professional_id);
```

**Notes:**
- `filename` is a UUID (e.g., `550e8400-e29b-41d4-a716-446655440000.pdf`)
- Physical file lives at `$FILES_PATH/<filename>`
- `ON DELETE CASCADE` from `consultations` — deleting a consultation deletes its file records (and the physical file, handled in application layer)

---

## Entity Relationships

```
User ──────────────── Consultation (1:N, CASCADE delete)
                             │
                             ├── File (1:N, CASCADE delete)
                             │      ├── FileCategory (N:1)
                             │      └── Professional (N:1, SET NULL)
                             │
                             └── Professional (N:1, RESTRICT delete)
                                      │
                                      ├── ProfessionalSpecialty (1:N, CASCADE)
                                      │      └── Specialty (N:1, CASCADE)
                                      │
                                      └── Clinic (N:1, SET NULL)
```

---

## Migration Files

```
migrations/
├── 001_initial_schema.sql    -- All existing tables (IF NOT EXISTS, safe for in-place upgrade)
└── 002_add_sessions.sql      -- sessions table + index (new in v2)
```

**Migration 001** replicates the Prisma-generated schema with `IF NOT EXISTS`. On a fresh database it creates everything. On an existing Prisma database it is a no-op for existing tables.

**Migration 002** creates the `sessions` table — always new, not created by Prisma.

---

## Application-Layer Constraints

These are not enforced by SQLite foreign keys but by handler logic:

| Constraint | Location |
|---|---|
| `role` must be 'ADMIN' or 'USER' | `models/user.go` |
| File MIME type must be PDF/PNG/JPEG | `handlers/files.go` |
| File size ≤ 10 MB | `handlers/files.go` |
| Dictionary entries referenced by records cannot be deleted | `handlers/{specialties,clinics,categories}.go` |
| Professionals with consultations cannot be bulk-deleted | `handlers/admin.go` |
| Only ADMIN role can access `/api/admin/*` | `middleware/auth.go` |
| USER role can only read/write their own consultations | `handlers/consultations.go` |
