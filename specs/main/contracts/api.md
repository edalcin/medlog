# API Contracts: MedLog v2

**Phase 1 Output** | **Date**: 2026-05-17

All responses use `Content-Type: application/json`. Successful responses: `{ data: T }` or `{ ok: true }`. Error responses: `{ error: string }`.

---

## Auth

### POST /api/auth/signin
```
Request:  { email: string, password: string }
Response: { data: { id, email, name, role, theme } }
Errors:   400 invalid request | 401 invalid credentials | 429 Too Many Requests
```

Rate limited: 5 attempts per IP per minute. Returns `Retry-After` header on 429.

### GET /api/auth/me
```
Response: { data: { id, email, name, role, theme } }
Errors:   401 (no session)
```

### POST /api/auth/signout
```
Response: { ok: true }
```

---

## Consultations

### GET /api/consultations?page=1&limit=20
```
Response: { data: Consultation[], total: number, page: number, limit: number }
```
Default: page=1, limit=20. Max limit=100.

### POST /api/consultations
```
Request:  { date, type, proposito?, notes?, professionalId?, rating? }
Response: { data: Consultation }
```

### GET /api/consultations/{id}
```
Response: { data: Consultation }
Errors:   404
```

### PUT /api/consultations/{id}
```
Request:  Partial<{ date, type, proposito, notes, professionalId, rating }>
Response: { data: Consultation }
Errors:   404
```

### DELETE /api/consultations/{id}
```
Response: { ok: true }
```

---

## Professionals

### GET /api/professionals?page=1&limit=20&active=true
```
Response: { data: Professional[], total, page, limit }
```

### POST /api/professionals
```
Request:  { name, notes?, isActive, specialtyIds, clinicId? }
Response: { data: Professional }
```

### GET /api/professionals/{id}
```
Response: { data: Professional }
```

### PUT /api/professionals/{id}
```
Request:  Partial<{ name, crm, notes, isActive, specialtyIds, clinicId }>
Response: { data: Professional }
```

### DELETE /api/professionals/{id}
```
Response: { ok: true }
Errors:   409 professional has consultations
```

### GET /api/professionals/{id}/phones
```
Response: { data: Phone[] }
```

### POST /api/professionals/{id}/phones
```
Request:  { number: string, label?: string }
Response: { data: Phone }
```

---

## Clinics

### GET /api/clinics?page=1&limit=20
```
Response: { data: Clinic[], total, page, limit }
```

### POST /api/clinics
```
Request:  { name: string, address?: string }
Response: { data: Clinic }
```

### PUT /api/clinics/{id}
```
Request:  { name: string, address?: string }
Response: { data: Clinic }
```

### DELETE /api/clinics/{id}
```
Response: { ok: true }
```

### GET /api/clinics/{id}/phones
```
Response: { data: Phone[] }
```

### POST /api/clinics/{id}/phones
```
Request:  { number: string, label?: string }
Response: { data: Phone }
```

---

## Phones

### PUT /api/phones/{id}
```
Request:  { number?: string, label?: string }
Response: { data: Phone }
```

### DELETE /api/phones/{id}
```
Response: { ok: true }
```

---

## Users (self-service)

### PATCH /api/users/me/theme
```
Request:  { theme: 'LIGHT' | 'DARK' | 'SYSTEM' }
Response: { data: User }
Errors:   400 invalid theme
```

### PUT /api/users/me/password
```
Request:  { currentPassword: string, newPassword: string }
Response: { ok: true }
Errors:   400 missing fields | 401 wrong current password
```

---

## Users (admin only)

### GET /api/users?page=1&limit=20
```
Response: { data: User[], total, page, limit }
```

### POST /api/users
```
Request:  { email, password, name, role }
Response: { data: User }
```

### GET /api/users/{id}
```
Response: { data: User }
```

### PUT /api/users/{id}
```
Request:  Partial<{ email, name, role, password }>
Response: { data: User }
```

### DELETE /api/users/{id}
```
Response: { ok: true }
```

---

## Specialties (GET: all users; POST/PUT/DELETE: admin)

### GET /api/specialties
```
Response: { data: Specialty[] }
```

### POST /api/specialties
```
Request:  { name: string }
Response: { data: Specialty }
```

### PUT /api/specialties/{id}
```
Request:  { name: string }
Response: { data: Specialty }
```

### DELETE /api/specialties/{id}
```
Response: { ok: true }
Errors:   409 specialty in use
```

---

## File Categories (same pattern as specialties)

### GET /api/file-categories → { data: FileCategory[] }
### POST /api/file-categories → { data: FileCategory }
### PUT /api/file-categories/{id} → { data: FileCategory }
### DELETE /api/file-categories/{id} → { ok: true } | 409

---

## Files

### POST /api/files (multipart)
```
Form fields: file, consultationId, professionalId?, categoryIds[]
Response: { data: MedFile }
```

### GET /api/files/{filename}
```
Response: Binary file content
Headers: Cache-Control: private, max-age=3600
```

### DELETE /api/files/{id}
```
Response: { ok: true }
```

---

## Dashboard

### GET /api/dashboard
```
Response: { data: DashboardStats }
```

---

## Admin

### GET /api/admin/stats
```
Response: { data: AdminStats }
```

### GET /api/admin/consultations?page=1&limit=20
```
Response: { data: Consultation[], total, page, limit }
```

### POST /api/admin/consultations/bulk-delete
```
Request:  { ids: string[] }
Response: { ok: true }
```

### GET /api/admin/professionals?page=1&limit=20
```
Response: { data: Professional[], total, page, limit }
```

### POST /api/admin/professionals/bulk-delete
```
Request:  { ids: string[] }
Response: { ok: true }
Errors:   409 professional has consultations
```

### GET /api/admin/files?page=1&limit=20
```
Response: { data: MedFile[], total, page, limit }
```

### GET /api/admin/login-logs?page=1&limit=50
```
Response: { data: LoginLog[], total, page, limit }
```

### GET /api/admin/backup
```
Response: Binary SQLite file download
```

### POST /api/admin/restore (multipart)
```
Form fields: file (SQLite database)
Response: { ok: true, message: string }
Errors:   400 invalid SQLite file
```

---

## Sharing

### GET /api/sharing/professionals
```
Response: { data: Sharing[] }
```

### POST /api/sharing/professionals
```
Request:  { targetUserId: string }
Response: { data: Sharing }
Errors:   404 user not found | 409 already shared
```

### DELETE /api/sharing/professionals/{targetUserId}
```
Response: { ok: true }
```

### GET /api/sharing/clinics
### POST /api/sharing/clinics  
### DELETE /api/sharing/clinics/{targetUserId}
(same pattern as professionals)

---

## Types

```typescript
interface Phone {
  id: string
  number: string
  label?: string
  professionalId?: string
  clinicId?: string
  createdAt: string
}

interface Sharing {
  id: string
  sharingFromUserId: string
  sharingToUserId: string
  targetUser: { id: string; name: string; email: string }
  createdAt: string
}

interface LoginLog {
  id: string
  userId: string
  userName: string
  userEmail: string
  ipAddress?: string
  userAgent?: string
  timestamp: string
}
```

---

## Error Response Format
```json
{ "error": "descriptive message" }
```

Status codes: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 429 Too Many Requests, 500 Internal Server Error.
