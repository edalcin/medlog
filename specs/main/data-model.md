# Data Model: MedLog v2 Code Review Implementation

**Phase 1 Output** | **Date**: 2026-05-17

---

## Existing Entities (unchanged schema, behavior changes only)

### User
```sql
users: id, email, username, name, password_hash, role, theme, created_at, updated_at
```
- **Changes**: `theme` field NOW USED (was ignored); new endpoint `PATCH /api/users/me` for theme

### Consultation
```sql
consultations: id, date, proposito, notes, type, rating, user_id, professional_id, created_at, updated_at
```
- **Changes**: `ConsultationUpdate` uses single dynamic SQL statement (no more multiple UPDATEs)

### Professional
```sql
professionals: id, name, crm, address, notes, is_active, user_id, clinic_id, created_at, updated_at
professional_specialties: id, professional_id, specialty_id, created_at
```
- **Changes**: `ProfessionalFindAll` uses batch load for specialties (was N+1)

### File
```sql
files: id, filename, custom_name, path, mime_type, size, hash, thumbnail_path, consultation_id, professional_id, user_id, uploaded_at
file_file_categories: id, file_id, category_id, created_at
```
- **Changes**: `FileFindByConsultationID` uses batch load for categories (was N+1)

### Phones (existing schema, NEW implementation)
```sql
phones: id, number, label, professional_id, clinic_id, created_at
```
- **Status**: Table exists in schema since initial migration, zero code
- **Changes**: Add `models/phone.go`, handlers, frontend UI

### login_logs (existing schema, EXTENDED)
```sql
login_logs: id, user_id, user_name, user_email, timestamp
```
- **Changes**: New migration adds `ip_address TEXT` and `user_agent TEXT`; admin view implemented

### user_professional_sharing (existing schema, NEW implementation)
```sql
user_professional_sharing: id, sharing_from_user_id, sharing_to_user_id, created_at
```
- **Changes**: Add model + handlers + frontend

### user_clinic_sharing (existing schema, NEW implementation)
```sql
user_clinic_sharing: id, sharing_from_user_id, sharing_to_user_id, created_at
```
- **Changes**: Add model + handlers + frontend

---

## New Entities

### rate_limit_attempts (NEW — migration #002)
```sql
CREATE TABLE rate_limit_attempts (
    ip           TEXT NOT NULL,
    window_start DATETIME NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ip, window_start)
);
-- No additional index needed (PK covers the lookup pattern)
```
- Purpose: Track failed login attempts per IP per time window
- Cleanup: Purged when window_start < NOW() - 2 minutes on each check

### app_config (NEW — migration #002)
```sql
CREATE TABLE app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```
- Purpose: Store configuration state (e.g., `session_secret_hash`)
- Used for SESSION_SECRET rotation detection

---

## Migration Strategy

### Migration #002_rate_limiting_and_config.sql
```sql
-- +goose Up
CREATE TABLE rate_limit_attempts (
    ip           TEXT NOT NULL,
    window_start DATETIME NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ip, window_start)
);

CREATE TABLE app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS app_config;
DROP TABLE IF EXISTS rate_limit_attempts;
```

### Migration #003_login_logs_extended.sql
```sql
-- +goose Up
ALTER TABLE login_logs ADD COLUMN ip_address TEXT;
ALTER TABLE login_logs ADD COLUMN user_agent TEXT;

-- +goose Down
-- SQLite doesn't support DROP COLUMN in older versions
-- No-op for down migration
```

---

## API Response Envelope Changes

All endpoints now return `{ "data": T }`. New pagination envelope for lists:

```typescript
// Singular response
{ data: T }

// List response (paginated endpoints)
{ data: T[], total: number, page: number, limit: number }
```

### Endpoints affected (backend change required)

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /auth/signin` | `{id, email, name, role}` | `{data: {id, email, name, role, theme}}` |
| `GET /auth/me` | `{id, email, name, role}` | `{data: {id, email, name, role, theme}}` |
| `GET /dashboard` | `DashboardStats` | `{data: DashboardStats}` |
| `POST /consultations` | `Consultation` | `{data: Consultation}` |
| `GET /consultations/{id}` | `Consultation` | `{data: Consultation}` |
| `PUT /consultations/{id}` | `Consultation` | `{data: Consultation}` |
| `GET /consultations` | `{data: [...]}` | `{data: [...], total, page, limit}` |
| `POST /professionals` | `Professional` | `{data: Professional}` |
| `GET /professionals/{id}` | `Professional` | `{data: Professional}` |
| `PUT /professionals/{id}` | `Professional` | `{data: Professional}` |
| `GET /professionals` | `{data: [...]}` | `{data: [...], total, page, limit}` |
| `GET /admin/stats` | `AdminStats` | `{data: AdminStats}` |
| All POST/PUT for specialties, categories, clinics, users | direct object | `{data: T}` |
| `GET /admin/consultations` | `{data: [...]}` | `{data: [...], total, page, limit}` |
| `GET /admin/professionals` | `{data: [...]}` | `{data: [...], total, page, limit}` |
| `GET /admin/files` | `{data: [...]}` | `{data: [...], total, page, limit}` |

Note: `DELETE` endpoints keep `{ ok: true }` — no wrapper needed.
Note: `POST /auth/signout` keeps `{ ok: true }`.

---

## New API Endpoints

### Phones
```
GET    /api/professionals/{id}/phones   → { data: Phone[] }
POST   /api/professionals/{id}/phones   → { data: Phone }
GET    /api/clinics/{id}/phones         → { data: Phone[] }
POST   /api/clinics/{id}/phones         → { data: Phone }
PUT    /api/phones/{id}                 → { data: Phone }
DELETE /api/phones/{id}                 → { ok: true }
```

### User self-service
```
PATCH  /api/users/me/theme              → { data: User }
PUT    /api/users/me/password           → { ok: true }
  body: { currentPassword: string, newPassword: string }
```

### Login logs (admin)
```
GET    /api/admin/login-logs?page=1&limit=50  → { data: LoginLog[], total, page, limit }
```

### Sharing
```
GET    /api/sharing/professionals             → { data: Sharing[] }
POST   /api/sharing/professionals             → { data: Sharing }
  body: { targetUserId: string }
DELETE /api/sharing/professionals/{userId}    → { ok: true }

GET    /api/sharing/clinics                   → { data: Sharing[] }
POST   /api/sharing/clinics                   → { data: Sharing }
DELETE /api/sharing/clinics/{userId}          → { ok: true }
```
