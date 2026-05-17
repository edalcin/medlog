# Research: MedLog v2 Code Review — Technical Decisions

**Phase 0 Output** | **Date**: 2026-05-17

---

## 1. SESSION_SECRET e SCS v2

**Decision**: Usar SESSION_SECRET para invalidar sessões quando o segredo mudar, via tabela `app_config`.

**Rationale**: SCS v2 com SQLite store já persiste sessões entre restarts (tokens armazenados no banco). A real necessidade do SESSION_SECRET é: quando o segredo muda, sessões antigas devem ser invalidadas (ex: rotação de segredo por suspeita de comprometimento). A abordagem mais simples e idiomática é:
1. Na tabela `app_config`, armazenar `session_secret_hash` = `SHA256(SESSION_SECRET)`
2. No startup: comparar hash atual vs stored hash
3. Se diferente → chamar `InvalidateAllSessions(db)` + atualizar hash
4. `Manager.Cookie.Name` usa um nome fixo "session" — sem mudança

**Alternatives considered**:
- HMAC-signed tokens: requereria wrapper customizado do SCS, adicionando ~100 linhas de complexidade; rejeitado
- `securecookie` gorilla: dependência externa desnecessária; rejeitado
- Sem mudança (apenas documentar): rejeitado porque spec exige implementação

**Files affected**: `internal/auth/session.go`, `cmd/medlog/main.go`, nova migration para `app_config`

---

## 2. Rate Limiting — sem dependências externas

**Decision**: Middleware chi customizado com tabela SQLite `rate_limit_attempts`.

**Schema**:
```sql
CREATE TABLE rate_limit_attempts (
    ip          TEXT NOT NULL,
    window_start DATETIME NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ip, window_start)
);
```

**Algorithm**:
- Window = 1 minuto (truncado ao minuto)
- Ao receber request: `INSERT OR REPLACE INTO rate_limit_attempts ... ON CONFLICT DO UPDATE SET attempts = attempts + 1`
- Se `attempts >= 5`: return 429
- Cleanup periódico: `DELETE WHERE window_start < now() - 2 minutes` (run a cada request ou via goroutine)

**Alternatives considered**:
- In-memory map com mutex: não persiste entre restarts, problemático em restart rápido; rejeitado
- `didip/tollbooth`: dependência externa; rejeitado
- Redis: dependência externa, violaria stack minimalista; rejeitado

**Files affected**: `internal/middleware/ratelimit.go` (novo), migration nova

---

## 3. N+1 Queries — Batch Loading

**Decision**: Substituir consultas N+1 por batch loads com `IN` clause em SQLite.

**consultationBase pattern**:
1. Query principal: busca todas as consultas (sem JOIN de professional)
2. Batch load professionals: `SELECT * FROM professionals WHERE id IN (...)`
3. Batch load files por consultation: `SELECT * FROM files WHERE consultation_id IN (...)`
4. Batch load categories por file: `SELECT ffc.file_id, fc.* FROM file_file_categories ffc JOIN file_categories fc ON fc.id = ffc.category_id WHERE ffc.file_id IN (...)`
5. Mapear tudo em memória usando maps

**Impact**: 100 consultas + 2 arquivos cada: 401 queries → 4 queries

**ProfessionalFindAll pattern**:
1. Query principal: busca todos os profissionais
2. Batch load specialties: `SELECT ps.professional_id, s.* FROM professional_specialties ps JOIN specialties s ON s.id = ps.specialty_id WHERE ps.professional_id IN (...)`
3. Mapear specialties por professional_id

**Helper function**:
```go
func inClause(n int) string {
    if n == 0 { return "(NULL)" }
    return "(?" + strings.Repeat(",?", n-1) + ")"
}
```

**Alternatives considered**:
- JOIN + GROUP_CONCAT para specialties: funciona no SQLite mas retorna strings que precisam de parsing; batch load mais idiomático em Go
- ORM (GORM): introduz complexidade e dependência pesada; rejeitado

---

## 4. API Response Standardization

**Decision**: Padronizar TODOS os endpoints para `{ data: T }`. Manter `{ error: string }` para erros (sem mudança).

**Scope das mudanças no backend**:
- `POST /auth/signin` → `{ data: { id, email, name, role, theme } }`
- `GET /auth/me` → `{ data: { id, email, name, role, theme } }`
- `GET /dashboard` → `{ data: DashboardStats }`
- `POST /consultations` → `{ data: Consultation }`
- `GET /consultations/{id}` → `{ data: Consultation }`
- `PUT /consultations/{id}` → `{ data: Consultation }`
- `POST /professionals` → `{ data: Professional }`
- `GET /professionals/{id}` → `{ data: Professional }`
- `PUT /professionals/{id}` → `{ data: Professional }`
- `GET /admin/stats` → `{ data: AdminStats }` 
- Todos os POST/GET/{id}/PUT de entidades simples (clinics, specialties, categories, users)

**Frontend**: Atualizar `api.ts` para extrair `.data` em todos os endpoints. Usar helper:
```typescript
async function request<T>(method, path, body?): Promise<T> {
  // ... fetch ...
  const json = await res.json()
  return json.data !== undefined ? json.data : json  // backward compat durante transição
}
```
Ou simplesmente atualizar cada `request<T>` type para `request<{data: T}>` e desempacotar.

**Alternatives considered**:
- Manter inconsistência atual: rejeitado (frágil, confuso)
- `{ data: T, meta: Pagination }` envelope: adotado para listas com paginação; endpoints singulares usam `{ data: T }` simples

---

## 5. Paginação

**Decision**: Cursor-based não necessário para este escopo; offset-based com `?page=1&limit=20` suficiente.

**Backend response envelope para listas**:
```json
{ "data": [...], "total": 150, "page": 1, "limit": 20 }
```

**SQL**:
```sql
SELECT ... LIMIT ? OFFSET ?   -- args: limit, (page-1)*limit
SELECT COUNT(*) FROM ...       -- mesma WHERE clause, sem LIMIT
```

**Default**: `limit=20, page=1`. Max limit: 100.

**Frontend**: Componentes de lista precisam de controles de paginação simples (prev/next + página atual).

---

## 6. ConsultationUpdate / UserUpdate — Transação

**Decision**: Construir query dinâmica com `strings.Builder` e executar como única statement (sem necessidade de transação para UPDATE único).

```go
func ConsultationUpdate(ctx context.Context, db *sql.DB, id string, in UpdateConsultationInput) (*Consultation, error) {
    var sets []string
    var args []any
    now := time.Now().UTC()
    
    if in.Date != nil { sets = append(sets, "date=?"); args = append(args, *in.Date) }
    // ... demais campos
    if len(sets) == 0 { return ConsultationFindByID(ctx, db, id) }
    
    sets = append(sets, "updated_at=?")
    args = append(args, now, id)
    
    _, err := db.ExecContext(ctx, 
        "UPDATE consultations SET "+strings.Join(sets, ",")+` WHERE id=?`, args...)
    if err != nil { return nil, err }
    return ConsultationFindByID(ctx, db, id)
}
```

Single statement = atomic em SQLite por natureza. Transaction only needed for multi-statement ops.

---

## 7. Tema Claro/Escuro

**Decision**: CSS custom properties no `app.css`, classe no `<body>`, toggle via `data-theme` attribute.

**Abordagem**:
```css
/* app.css */
:root, [data-theme="dark"] { --bg: #0f1117; /* ... dark vars */ }
[data-theme="light"] { --bg: #f8f9fa; /* ... light vars */ }
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { --bg: #f8f9fa; /* ... light */ }
}
```

**Svelte**: `$effect` em `App.svelte` para aplicar `document.documentElement.setAttribute('data-theme', theme)` baseado no `theme` do usuário logado.

**Endpoint**: `PATCH /api/users/me` com `{ theme: 'LIGHT' | 'DARK' | 'SYSTEM' }` — reutiliza lógica de `UserUpdate` já existente.

---

## 8. marked — Biblioteca Markdown

**Decision**: `npm install marked` (v15.x, sem dependências transitivas).

**Usage**:
```typescript
import { marked } from 'marked'

// Em MarkdownPreview.svelte
function renderMarkdown(md: string): string {
    if (!md) return ''
    // marked.parse() retorna HTML — precisa de sanitização
    // Como o conteúdo vem do próprio usuário (trusted), DOMPurify seria opcional
    // Por segurança, usar marked com opção walkTokens para sanitizar URLs
    return marked.parse(md) as string
}
```

**XSS**: O conteúdo das notas vem do próprio usuário autenticado → risco baixo. Adicionar `marked.setOptions({ headerIds: false })` para evitar injection em IDs de heading.

**Alternatives considered**:
- `markdown-it`: mais features, mais pesado; marked suficiente
- `micromark`: baixo nível, requer assembler; rejeitado
- Manter regex: limitado demais; rejeitado

---

## 9. Phones CRUD

**Decision**: Endpoints aninhados sob professionals e clinics.

```
GET    /professionals/{id}/phones
POST   /professionals/{id}/phones
DELETE /phones/{id}
PUT    /phones/{id}

GET    /clinics/{id}/phones
POST   /clinics/{id}/phones
```

**Model**: Já existe no schema. Sem migration necessária.

---

## 10. Sharing entre Usuários

**Decision**: Tabelas já existem no schema. Endpoints de gerenciamento de compartilhamento.

```
GET    /sharing/professionals      — lista quem você está compartilhando
POST   /sharing/professionals      — compartilhar com outro usuário
DELETE /sharing/professionals/{targetUserId}

GET    /sharing/clinics
POST   /sharing/clinics
DELETE /sharing/clinics/{targetUserId}
```

**Scope dos dados compartilhados**: quando usuário B tem acesso aos profissionais de A, os profissionais de A aparecem nas listagens de B (scoped pela tabela de sharing).

---

## 11. Login Logs Admin View

**Decision**: Aba "Logs de Acesso" no `Admin.svelte`. Novo endpoint paginado.

```
GET /admin/login-logs?page=1&limit=50
Response: { data: [...], total, page, limit }
```

Colunas: `user_email`, `user_name`, `timestamp` (a tabela atual NÃO tem IP/user-agent).

**Migration adicional**: Adicionar colunas `ip_address TEXT` e `user_agent TEXT` na tabela `login_logs` para informação mais útil.

---

## 12. Integration Tests

**Decision**: SQLite `:memory:` + `httptest.NewRecorder()`. Usar `testing.T` padrão Go, sem framework externo.

**Pattern**:
```go
func TestConsultationCreate(t *testing.T) {
    db := setupTestDB(t)  // Open(":memory:") + Migrate()
    h := &ConsultationHandler{DB: db, FilesPath: t.TempDir()}
    // httptest.NewRecorder + httptest.NewRequest
    // assert response
}
```

**Priority order**: auth → consultations → professionals → admin

---

## 13. Docker Paths

**Decision**: Alinhar TUDO para `/app/data/`:
- `docker-compose.yml`: `- ./data:/app/data`, env vars com `/app/data/`  
- `.env.example`: paths com `/app/data/`
- `docker-entrypoint.sh`: já correto

Remover SESSION_SECURE do docker-compose (não deve ter default); mantê-lo em `.env.example`.
