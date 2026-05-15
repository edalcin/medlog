# API Contract: MedLog v2 REST API

**Base URL:** `/api`  
**Auth:** All endpoints except `POST /api/auth/signin` and `GET /health` require a valid session cookie.  
**Content-Type:** `application/json` for all request/response bodies except file upload (multipart/form-data).  
**Error format:** `{"error": "message"}` with appropriate HTTP status code.

---

## Auth

### POST /api/auth/signin
Sign in with email and password. Creates a server-side session.

**Request:**
```json
{ "email": "user@example.com", "password": "secret" }
```
**Response 200:**
```json
{ "id": "uuid", "email": "user@example.com", "name": "Name", "role": "USER" }
```
**Response 401:** `{"error": "invalid credentials"}`

---

### POST /api/auth/signout
Destroys the current session.

**Response 200:** `{"ok": true}`

---

### GET /api/auth/me
Returns the current authenticated user.

**Response 200:**
```json
{ "id": "uuid", "email": "user@example.com", "name": "Name", "role": "USER" }
```
**Response 401:** `{"error": "unauthorized"}`

---

## Consultations

### GET /api/consultations
List consultations for the current user. ADMIN sees all.

**Query params:** `?page=1&limit=20&professionalId=uuid&from=2024-01-01&to=2024-12-31`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "date": "2024-06-15T10:00:00Z",
      "type": "CONSULTATION",
      "notes": "Markdown string",
      "professional": { "id": "uuid", "name": "Dr. Name", "specialties": [...] },
      "files": [{ "id": "uuid", "originalName": "exam.pdf", "mimeType": "application/pdf", "category": {...} }]
    }
  ],
  "total": 42
}
```

---

### POST /api/consultations
Create a consultation.

**Request:**
```json
{
  "date": "2024-06-15T10:00:00Z",
  "type": "CONSULTATION",
  "notes": "Optional markdown",
  "professionalId": "uuid"
}
```
**Response 201:** Full consultation object (same shape as list item).

---

### GET /api/consultations/:id
**Response 200:** Full consultation object. **Response 404** if not found or not owned by current user.

---

### PUT /api/consultations/:id
**Request:** Same fields as POST (all optional, only provided fields updated).
**Response 200:** Updated consultation object.

---

### DELETE /api/consultations/:id
**Response 200:** `{"ok": true}`  
Cascades: deletes associated file records + physical files.

---

## Professionals

### GET /api/professionals
**Query params:** `?active=true` (default: returns all for ADMIN, only active for USER new-consultation forms)

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid", "name": "Dr. Name", "notes": null, "isActive": true,
      "specialties": [{ "id": "uuid", "name": "Cardiologia" }],
      "clinic": { "id": "uuid", "name": "Hospital Particular" }
    }
  ]
}
```

---

### POST /api/professionals
**Request:**
```json
{
  "name": "Dr. Name",
  "notes": "Optional",
  "isActive": true,
  "specialtyIds": ["uuid"],
  "clinicId": "uuid"
}
```
**Response 201:** Full professional object.

---

### GET /api/professionals/:id  
### PUT /api/professionals/:id  
### DELETE /api/professionals/:id

Standard CRUD. DELETE returns 409 if professional has consultations.

---

## Files

### POST /api/files
Upload a file. Multipart form.

**Form fields:**
- `file`: binary (PDF/PNG/JPG, max 10 MB)
- `consultationId`: UUID
- `professionalId`: UUID (optional)
- `categoryId`: UUID

**Response 201:**
```json
{ "id": "uuid", "filename": "uuid.pdf", "originalName": "exam.pdf", "mimeType": "application/pdf", "size": 102400 }
```
**Response 413:** file exceeds 10 MB  
**Response 415:** unsupported MIME type

---

### GET /api/files/:filename
Serves the file binary. Requires valid session. Sets `Content-Disposition: inline`.

---

### DELETE /api/files/:id
Deletes file record + physical file.
**Response 200:** `{"ok": true}`

---

## Dictionaries (Specialties, File Categories, Clinics)

Same contract shape for all three. Replace `{resource}` with `specialties`, `file-categories`, or `clinics`.

### GET /api/{resource}
**Response 200:** `{ "data": [{ "id": "uuid", "name": "Name" }] }`

### POST /api/{resource}
**Request:** `{ "name": "Name" }`  
**Response 201:** `{ "id": "uuid", "name": "Name" }`  
**Response 409:** name already exists

### PUT /api/{resource}/:id
**Request:** `{ "name": "New Name" }`  
**Response 200:** updated object

### DELETE /api/{resource}/:id
**Response 200:** `{"ok": true}`  
**Response 409:** `{"error": "in use"}` — entry referenced by existing records

---

## Users (ADMIN only)

### GET /api/users  
### POST /api/users  
**Request:** `{ "email": "...", "password": "...", "name": "...", "role": "USER" }`

### GET /api/users/:id  
### PUT /api/users/:id  
### DELETE /api/users/:id

All return 403 for non-ADMIN sessions.

---

## Admin

### GET /api/admin/stats
**Response 200:**
```json
{ "users": 3, "consultations": 142, "professionals": 12, "files": 89 }
```

### GET /api/admin/consultations
All consultations across all users. Supports same query params as `GET /api/consultations`.

### DELETE /api/admin/consultations/bulk-delete
**Request:** `{ "ids": ["uuid1", "uuid2"] }`  
**Response 200:** `{"deleted": 2}`

### GET /api/admin/professionals
All professionals.

### DELETE /api/admin/professionals/bulk-delete
**Request:** `{ "ids": ["uuid1", "uuid2"] }`  
**Response 200:** `{"deleted": 2}`  
**Response 409:** `{"error": "professional uuid1 has consultations"}`

### GET /api/admin/files
All files with metadata.

### GET /api/admin/backup
Downloads the SQLite file. Performs WAL checkpoint before serving.  
**Response 200:** `Content-Type: application/octet-stream`, `Content-Disposition: attachment; filename=medlog-backup-YYYYMMDD.sqlite`

### POST /api/admin/restore
Uploads a `.sqlite` file to replace the live database.  
**Form field:** `file` (application/octet-stream or application/x-sqlite3)  
**Steps:** validate SQLite magic bytes → write to temp file → disconnect SCS session store → delete WAL/SHM → rename to live path → invalidate all sessions → reconnect.  
**Response 200:** `{"ok": true, "message": "Restauração concluída. Faça login novamente."}`  
**Response 400:** `{"error": "invalid SQLite file"}`

---

## Health

### GET /health
No authentication required.

**Response 200:** `{"status":"ok","db":"connected"}`  
**Response 503:** `{"status":"error","db":"unreachable"}`
