# Quickstart: MedLog v2 Code Review Implementation

**Phase 1 Output** | **Date**: 2026-05-17

## Pre-requisites

- Go 1.24+
- Node.js 20+
- Docker (for integration testing)

## Development Setup

```bash
# Backend hot-reload
go run ./cmd/medlog

# Frontend hot-reload (proxies /api to :3000)
cd frontend && npm install && npm run dev

# Run Go tests
go test ./...

# Build frontend for embedding
cd frontend && npm run build

# Full Docker build
docker build -t medlog:v2 .
```

## Environment Variables

```env
DATABASE_URL=file:./data/db/medlog.sqlite
FILES_PATH=./data/uploads
SESSION_SECRET=<openssl rand -base64 32>
PORT=3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme
SESSION_SECURE=false
```

## Implementation Order

1. **Fase 1 — Críticos** (items #1–#6): Start here. These are blocking issues.
   - Run migrations 002 before testing rate limiting or SESSION_SECRET
   - N+1 fix is testable by checking SQL logs (enable `?_trace=1` in DATABASE_URL for dev)

2. **Fase 2 — Alta Prioridade** (#7–#15): After critical items are stable.
   - API standardization (#7) must come before paginação (#8) — changes response format
   - Theme (#14) requires frontend CSS work + backend endpoint

3. **Fase 3 — Média** (#16–#22): After API is stable.
   - Tests (#16) should be written against the new API format

4. **Fase 4 — Baixa** (#23–#30): Last.

## Key Files by Phase

### Fase 1
- `internal/middleware/ratelimit.go` — NEW
- `internal/migrations/002_rate_limiting_and_config.sql` — NEW
- `internal/migrations/003_login_logs_extended.sql` — NEW
- `internal/models/consultation.go` — N+1 fix
- `internal/models/professional.go` — N+1 fix
- `internal/models/file.go` — N+1 fix
- `internal/middleware/security.go` — CSP
- `internal/auth/session.go` — SESSION_SECRET
- `docker-compose.yml`, `.env.example` — paths
- `cmd/migrate-mariadb/`, `cmd/sqlite-import/` — DELETE

### Fase 2
- All `internal/handlers/*.go` — `{ data: T }` wrapper
- `frontend/src/lib/api.ts` — `.data` unwrapping
- `frontend/src/app.css` — theme CSS variables
- `frontend/src/routes/Reports.svelte` — badge fix (5min)

### Fase 3
- `internal/models/phone.go` — NEW
- `internal/handlers/phones.go` — NEW
- `frontend/package.json` — add `marked`
- `frontend/src/components/MarkdownPreview.svelte` — use marked

## Testing Strategy

```bash
# Unit tests (after Phase 3)
go test ./internal/models/...
go test ./internal/handlers/...

# Manual integration test for rate limiting
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# 6th request should return 429

# Test SESSION_SECRET rotation
# 1. Start server with SECRET=abc, login
# 2. Stop server, change SECRET=xyz, restart  
# 3. Previous session should be invalidated (401 on /api/auth/me)
```
