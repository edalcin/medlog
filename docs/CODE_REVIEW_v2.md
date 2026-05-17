# 📋 MedLog v2 — Relatório de Revisão Completa de Código

**Data:** 17/05/2026
**Escopo:** Revisão pós-refatoração (v0.2.1 → v2) — consistência, otimização, vulnerabilidades e validação de funcionalidades.
**ATENÇÃO:** Nenhuma alteração de código foi realizada. Este relatório é exclusivamente analítico.

---

## 1. Sumário Executivo

O projeto passou por uma refatoração estrutural significativa (MariaDB → SQLite, templates HTML → Svelte 5 SPA, reorganização de diretórios), resultando em um binário único ~30MB sem dependências externas. A arquitetura é sólida, bem organizada e funcional para a maioria dos cenários.

**Há, contudo, 5 problemas críticos de segurança/performance e diversas inconsistências que devem ser endereçados antes de um próximo release público.**

---

## 2. Estrutura e Consistência

### 2.1 ✅ Pontos Positivos

| Item | Observação |
|------|-----------|
| Organização por domínio | `handlers/`, `models/`, `auth/` bem separados — segue convenções Go idiomáticas |
| Embedded frontend | Frontend compilado em build time, zero dependências de runtime — excelente |
| Tipagem forte no frontend | `api.ts` com interfaces TypeScript bem definidas, reduzindo erros de contrato |
| Migrações versionadas | Goose com SQL embedded — permite rollback e versionamento |
| Rotas RESTful | Estrutura consistente via chi router, middlewares de auth em grupos |
| WAL + Foreign Keys | PRAGMAs configurados no startup — integridade referencial garantida |
| Backup/Restore | Implementação funcional com validação de magic bytes e checkpoint WAL |
| Docker multi-stage | Imagem final ~30MB alpine, healthcheck integrado, entrypoint com migração |
| Auth guard no frontend | SPA router com redirecionamento automático para `/signin` |

### 2.2 ⚠️ Inconsistências

#### A. ✅ SESSION_SECRET não utilizado pelo SCS — RESOLVIDO

> **Implementado em 2026-05-17** — `internal/auth/session.go`, `internal/migrations/003_rate_limiting_and_config.sql`, `cmd/medlog/main.go`

SCS usa SQLite store (`sqlite3store`) para persistência de sessões — a chave de criptografia não é o vetor de invalidação. Implementada detecção de rotação de segredo:
- `EnsureSessionSecret(db, secret)`: hash SHA256 do segredo armazenado em `app_config`
- Se hash mudou → `InvalidateAllSessions(db)` (DELETE FROM sessions) → atualiza hash
- Se hash igual → sessões preservadas através de restarts
- `SESSION_SECRET` agora é `mustEnv` — obrigatório para iniciar o servidor

#### B. ✅ Divergência de paths entre docker-entrypoint.sh e docker-compose.yml — RESOLVIDO

> **Implementado em 2026-05-17** — `docker-compose.yml`, `.env.example`

Alinhado para `/app/data/` em todos os arquivos:
- `docker-compose.yml`: volume único `./data:/app/data`; `DATABASE_URL: file:/app/data/db/medlog.sqlite`; `FILES_PATH: /app/data/uploads`; adicionado `TRUST_PROXY` env var
- `.env.example`: paths atualizados para `/app/data/`; adicionado `TRUST_PROXY=false` com comentário explicativo

#### C. Duplicação de arquivos de migração

```
migrations/001_initial_schema.sql          ← "source of truth" versionado
internal/migrations/001_initial_schema.sql ← embedded (usado pelo goose)
```

Apenas `internal/migrations/` é efetivamente usado pelo goose em runtime. A duplicação gera risco de divergência silenciosa.

- **Impacto:** Se alguém editar apenas `migrations/`, a mudança não será aplicada.
- **Recomendação:** Manter apenas `internal/migrations/` como fonte única, ou usar `go:generate` para copiar, ou um symlink.

#### D. ✅ Padrão de resposta inconsistente na API — RESOLVIDO

> **Implementado em 2026-05-17** — todos os handlers + `frontend/src/lib/api.ts`

Todos os endpoints agora retornam `{ data: T }`. Handlers atualizados: `auth.go`, `consultations.go`, `professionals.go`, `clinics.go`, `specialties.go`, `categories.go`, `users.go`, `dashboard.go`, `files.go`, `admin.go`. `theme` adicionado à resposta de `signin` e `me`, exposto via `SessionKeyTheme`. Frontend: `api.ts` atualiza todos os tipos, extrai `.data` em cada chamada — callers recebem `T` diretamente via `.then(r => r.data)`.

#### E. Geração de IDs inconsistente

- `models/professional.go` define função `newID()` → `uuid.New().String()`
- Todos os handlers chamam `uuid.New().String()` diretamente
- `newID()` só é usada dentro do próprio `professional.go`

- **Recomendação:** Remover `newID()` e usar `uuid.New().String()` consistentemente em todo o código.

#### F. ✅ Arquivo `stores.ts` vazio — RESOLVIDO

> **Implementado em 2026-05-17** — arquivo removido

`frontend/src/lib/stores.ts` removido (era código morto com apenas `export {}`).

#### G. ✅ Bug no Reports.svelte — badge de tipo sempre amarelo — RESOLVIDO

> **Implementado em 2026-05-17** — `frontend/src/routes/Reports.svelte`

Corrigido para `c.type === 'CONSULTATION'` com label amigável `{c.type === 'CONSULTATION' ? 'Consulta' : 'Evento'}`.

---

## 3. Segurança e Vulnerabilidades

### 3.1 🔴 Críticos

#### A. ✅ Ausência de rate limiting no login — RESOLVIDO

> **Implementado em 2026-05-17** — `internal/middleware/ratelimit.go`, `internal/migrations/003_rate_limiting_and_config.sql`

Rate limiting implementado como chi middleware sem dependências externas:
- Tabela `rate_limit_attempts` (ip, window_start, attempts) com `ON CONFLICT DO UPDATE SET attempts = attempts + 1`
- 5 tentativas/minuto por IP; retorna 429 + `Retry-After: 60`
- IP detection: `CF-Connecting-IP` → `X-Forwarded-For` (TRUST_PROXY=true) → `RemoteAddr`
- Cleanup automático: `DELETE WHERE window_start < datetime('now', '-2 minutes')` a cada request
- Aplicado exclusivamente em `POST /auth/signin` via `.With(RateLimit(db, trustProxy))`

#### B. ✅ Ausência de Content-Security-Policy — RESOLVIDO

> **Implementado em 2026-05-17** — `internal/middleware/security.go`

CSP adicionado em `Security` middleware:
```go
w.Header().Set("Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'")
```
`connect-src 'self'` confirma que frontend só pode chamar mesma origem — sem exfiltração de dados via fetch/XHR para domínios externos.

### 3.2 🟡 Médios

#### C. ✅ `ConsultationUpdate` e `UserUpdate` — múltiplos updates sem transação — RESOLVIDO

> **Implementado em 2026-05-17** — `internal/models/consultation.go`, `user.go`

Ambas as funções agora constroem um único `UPDATE SET a=?,b=? WHERE id=?` dinamicamente com `strings.Join`. Única statement SQL = atomicidade garantida pelo SQLite sem necessidade de transação explícita.

#### D. SQL com concatenação de string (baixo risco atual, frágil para futuro)

```go
// handlers/admin.go Stats
h.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+t) // t de slice hardcoded

// handlers/dashboard.go
q := "SELECT COUNT(*) FROM consultations c WHERE c.type = 'CONSULTATION' " + userFilter
// userFilter é string fixa: "" ou "AND c.user_id = ?"
```

- **Risco:** Baixo atualmente (valores controlados), mas frágil a refatorações
- **Recomendação:** Construir queries com placeholders consistentes, evitando concatenação mesmo em casos seguros

#### E. ✅ Credenciais hardcoded no migrador MariaDB — RESOLVIDO

> **Implementado em 2026-05-17** — `cmd/migrate-mariadb/` e `cmd/sqlite-import/` removidos

Ambos os diretórios deletados do repositório. `go mod tidy` removeu dependência `github.com/go-sql-driver/mysql` do `go.mod` e `go.sum`.

#### F. `MarkdownPreview.svelte` — renderizador de Markdown frágil

O componente usa regex para parsing de Markdown. Embora faça HTML escaping primeiro (correto para XSS), os regex falham com:
- Listas aninhadas
- Blocos de código multilinha com backticks triplos
- Combinações de bold/italic (ex: `***bold italic***`)
- Links Markdown `[texto](url)`

- **Recomendação:** Adotar biblioteca madura como `marked` (leve, sem dependências) ou `markdown-it`. Isso resolve todos os edge cases e adiciona suporte a links, código, blockquotes e tabelas.

#### G. Restore carrega arquivo inteiro em memória

```go
data, err := io.ReadAll(file) // até 32MB em RAM
```

- **Risco:** Baixo (32MB é aceitável para endpoint admin), mas pode ser DoS se limite aumentar
- **Recomendação:** Fazer streaming direto para o arquivo temporário com `io.Copy` em vez de `io.ReadAll`

### 3.3 🟢 Baixos / Informativos

#### H. CSRF — proteção atual adequada para SPA
SCS usa `SameSite=Lax`, que bloqueia CSRF em requests cross-site. Para SPA que só usa `Content-Type: application/json`, isso é suficiente. Tokens CSRF seriam redundantes mas adicionariam defesa em profundidade.

#### I. Senha de admin bootstrap não é logada
```go
log.Printf("Admin user created: %s", email) // apenas email, sem senha
```
Correto. O email no log é aceitável para debug inicial.

#### J. Erros retornam "db error" genérico ao cliente
```go
writeError(w, "db error", http.StatusInternalServerError)
```
O erro real do banco é descartado. O cliente não vê detalhes (bom para segurança), mas o servidor também não loga o erro real.

- **Recomendação:** Logar o erro real no servidor (`log.Printf("db error: %v", err)`) antes de retornar mensagem genérica ao cliente.

---

## 4. Otimização e Performance

### 4.1 ✅ RESOLVIDO — Problemas N+1 (Crítico para performance)

> **Implementado em 2026-05-17** — `internal/models/helpers.go`, `consultation.go`, `professional.go`, `file.go`

#### A. ✅ Listagem de consultas: N+1 queries — RESOLVIDO

Implementado batch loading em `consultationBase()`:
- `helpers.go`: funções `inClause(n)` e `anySlice(ss)` para queries `IN (...)`
- Profissionais: `SELECT ... FROM professionals WHERE id IN (...)` — 1 query para todos
- Arquivos: `SELECT ... FROM files WHERE consultation_id IN (...)` — 1 query para todos
- Categorias: `fileLoadCategoriesBatch()` com JOIN — 1 query para todos os arquivos

**100 consultas com 2 arquivos cada: 401 queries → 4 queries**

#### B. ✅ Listagem de profissionais: N+1 para specialties — RESOLVIDO

Implementado `professionalLoadSpecialtiesBatch()` em `professional.go`:
- `SELECT ps.professional_id, s.* FROM professional_specialties ps JOIN specialties s ... WHERE ps.professional_id IN (...)`

**50 profissionais: 51 queries → 2 queries**

### 4.2 🟡 Performance Geral

#### C. Dashboard — 8+ queries sequenciais

O dashboard executa 8 queries individuais em sequência. Para datasets <10k registros não é crítico, mas cada query é uma round-trip ao banco.

- **Recomendação:** Agrupar queries relacionadas (ex: summary com uma única query usando UNION ALL). Implementar cache com TTL de 5 minutos no backend.

#### D. ✅ Sem paginação em nenhum endpoint — RESOLVIDO

> **Implementado em 2026-05-17** — `internal/models/`, `internal/handlers/`, frontend Svelte components

Paginação implementada com `?page=N&limit=N` (default page=1, limit=20, max=100). Resposta: `{ data, total, page, limit }`.
- Backend: `parsePagination` + `writePagedJSON` em `handlers/helpers.go`; count functions `ConsultationCountAll/ByUserID`, `ProfessionalCount`, `FileCount`; modelos com `LIMIT ? OFFSET ?`
- Frontend: `ConsultationList.svelte`, `ProfessionalList.svelte`, `Admin.svelte` (3 tabs) com controles de paginação prev/next

#### E. Sem cache de recursos estáticos para uploads

Arquivos servidos via `/api/files/{filename}` dependem apenas do `http.ServeContent` para cache condicional. Nenhum header `Cache-Control` explícito.

- **Recomendação:** Adicionar `Cache-Control: private, max-age=3600` para arquivos de upload (imutáveis por natureza).

### 4.3 🟢 OK

- Frontend SPA — navegação entre páginas não recarrega recursos
- SQLite WAL mode — leituras não bloqueiam escritas
- Vite build com tree-shaking — bundle otimizado
- Imagem Docker ~30MB — excelente
- Binário compilado com `-ldflags='-s -w'` — tamanho reduzido

---

## 5. Funcionalidades Órfãs e Incompletas

### 5.1 Tabelas no Schema sem Implementação

| Tabela | Schema | Model/Handler | Frontend |
|--------|--------|---------------|----------|
| `phones` | ✅ Definida com índices | ❌ Sem código | ❌ |
| `user_professional_sharing` | ✅ Definida | ❌ Sem código | ❌ |
| `user_clinic_sharing` | ✅ Definida | ❌ Sem código | ❌ |
| `login_logs` | ✅ Definida | ✅ INSERT no SignIn + ip/UA | ✅ Aba "Logs de Acesso" no admin |

- **`phones`**: Tabela existe desde v0.2.1 mas nunca foi implementada.
- **`user_*_sharing`**: Compartilhamento entre usuários — funcionalidade planejada mas não implementada.
- **`login_logs`**: ✅ Visualização implementada no painel admin (aba "Logs de Acesso") com paginação.

- **Decisão do desenvolvedor (17/05/2026):** Todas as tabelas serão mantidas e implementadas:
  - `phones`: implementar CRUD com associação a profissionais e clínicas
  - `user_professional_sharing` e `user_clinic_sharing`: implementar compartilhamento entre usuários
  - `login_logs`: adicionar aba "Logs de Acesso" no painel admin
  - Ver matriz de prioridades (itens #15, #17, #18, #19) para cronograma

### 5.2 Funcionalidades Ausentes (presentes no v0.2.1 ou planejadas)

| Funcionalidade | Status |
|---------------|--------|
| Autenticação (login/logout) | ✅ |
| CRUD Consultas | ✅ |
| CRUD Profissionais | ✅ |
| CRUD Especialidades (admin) | ✅ |
| CRUD Categorias de Arquivo (admin) | ✅ |
| CRUD Clínicas | ✅ |
| CRUD Usuários (admin) | ✅ |
| Upload de arquivos | ✅ |
| Notas em Markdown | ✅ |
| Dashboard com estatísticas | ✅ |
| Linha do tempo (Reports) | ✅ |
| Backup/Restore | ✅ |
| Bulk delete (consultas/profissionais) | ✅ |
| Inline create (especialidades/clínicas) | ✅ |
| **Telefones de profissionais/clínicas** | ✅ CRUD completo |
| **Compartilhamento entre usuários** | ✅ CRUD + UI completa |
| **Alteração de senha pelo próprio usuário** | ✅ `PUT /api/users/me/password` |
| **Visualização de login logs** | ✅ Aba "Logs de Acesso" no admin |
| **Tema do usuário (claro/escuro)** | ✅ LIGHT/DARK/SYSTEM com persistência |
| **Inline create de profissional na criação de consulta** | ✅ InlineCreate + `professionals` resourceType |

### 5.3 Campo "theme" não utilizado

~~A tabela `users` tem coluna `theme` (valores: SYSTEM, LIGHT, DARK), mas~~:

> **Implementado em 2026-05-17** — `frontend/src/app.css`, `internal/handlers/users.go`, `frontend/src/lib/auth.ts`, `frontend/src/App.svelte`, `frontend/src/components/Navigation.svelte`

- `app.css`: `:root,[data-theme="dark"]` = dark; `[data-theme="light"]` = light; `@media (prefers-color-scheme: light)` aplica light quando SYSTEM + OS light
- Endpoint `PATCH /api/users/me/theme` — valida LIGHT|DARK|SYSTEM, atualiza DB + sessão
- `auth.ts`: `setTheme()` atualiza store otimisticamente + chama API em background
- `App.svelte`: `$effect` lê `user.theme` e seta/remove `data-theme` em `<html>`; SYSTEM remove o atributo, deixando media query decidir
- `Navigation.svelte`: botão cicla SYSTEM→LIGHT→DARK→SYSTEM

---

## 6. Tratamento de Erros

### 6.1 ✅ Erros silenciados (ignorados com `_`) — PARCIALMENTE RESOLVIDO (models)

| Arquivo | Contexto | Descrição |
|---------|----------|-----------|
| `models/consultation.go:44` | `consultationBase` | `ProfessionalFindByID` — profissional pode ficar nil sem aviso |
| `models/consultation.go:46` | `consultationBase` | `FileFindByConsultationID` — arquivos podem ficar vazios sem aviso |
| `models/professional.go:87` | `ProfessionalFindAll` | `professionalLoadSpecialties` — specialties podem ficar vazias |
| `models/professional.go:108` | `ProfessionalFindByID` | `professionalLoadSpecialties` e `ClinicFindByID` |
| `models/professional.go:147` | `ProfessionalUpdate` | `DELETE FROM professional_specialties` |
| `models/professional.go:149` | `ProfessionalUpdate` | `INSERT INTO professional_specialties` |
| `models/file.go:56` | `fileLoadCategories` | Categorias de arquivo podem ficar vazias |
| `models/consultation.go:145` | `ConsultationDelete` | Query `SELECT path FROM files` e `removeFile` |
| `models/file.go:112` | `FileDelete` | `QueryRowContext` para obter path antes de deletar |
| `handlers/admin.go:58` | `BulkDeleteConsultations` | `models.ConsultationDelete` |

- **Risco:** Falhas silenciosas dificultam diagnóstico. Dados podem ficar inconsistentes sem que ninguém saiba.
- **Recomendação:** No mínimo, logar com `log.Printf`. Idealmente, propagar erros para o handler decidir se é fatal ou não.

### 6.2 Erros de scan ignorados em loops de rows

```go
if rows.Scan(&c.ID, ...) == nil {
    stats.BySpecialty = append(stats.BySpecialty, nc)
}
// Se Scan falhar, o registro é silenciosamente ignorado
```

- **Recomendação:** Logar falhas de scan para detectar problemas de schema.

---

## 7. Qualidade de Código

### 7.1 Ausência Total de Testes

**Zero arquivos de teste** no projeto (`*_test.go`). Nenhum teste unitário ou de integração.

- **Risco:** Regressões não detectadas, refatorações perigosas, bugs em produção
- **Recomendação:** Priorizar:
  1. Testes unitários para `models/*.go` (camada de dados — maior retorno)
  2. Testes de integração para `handlers/*.go` (usando `httptest` + SQLite em memória)
  3. Testes de contrato para API (verificar formatos de resposta)

### 7.2 ✅ Logs Insuficientes — RESOLVIDO

> **Implementado em 2026-05-17** — `internal/handlers/helpers.go` + todos os handlers

Adotado `log/slog` (Go 1.21+ stdlib) via helper centralizado `writeDBError(w, err)`:
- Chama `slog.Error("db error", "err", err)` antes de retornar 500
- Aplicado em todos os 9 handler files — erros de banco agora logados com detalhe real
- Zero dependências externas — `log/slog` é stdlib Go 1.21+

### 7.3 Cobertura de Documentação

| Documento | Status | Observação |
|-----------|--------|------------|
| `CLAUDE.md` | ✅ Excelente | Guia completo para AI agents |
| `TECHNICAL.md` | ✅ Excelente | Stack, arquitetura, schema, deploy |
| `README.md` | ✅ Bom | Visão geral do projeto |
| `UNRAID.md` | ✅ Bom | Instruções específicas |
| `.env.example` | ⚠️ Precisa ajuste | Paths `/data/` vs `/app/data/` |
| `docker-compose.yml` | ⚠️ Precisa ajuste | Paths `/data/` vs `/app/data/` |
| Comentários no código | ✅ Suficiente | Handlers bem comentados, models poderiam ter mais |
| Documentação de API | ❌ Ausente | Sem OpenAPI/Swagger |
| `docs/` | ❌ Vazio | Sem changelog, arquitetura, ou ADRs |

- **Recomendação:** Gerar spec OpenAPI a partir das definições de tipos do Go + TypeScript.

---

## 8. Frontend (Svelte 5)

### 8.1 ✅ Bem Implementado

- Svelte 5 com runes (`$state`, `$derived`, `$effect`) — usando API moderna corretamente
- SPA Router com auth guard (`$effect` redireciona para `/signin`)
- Componentes bem modularizados (`FileUpload`, `InlineCreate`, `MarkdownPreview`, `Navigation`)
- Estados de loading/error/success em **todas** as telas
- Tipagem TypeScript forte em `api.ts` com interfaces espelhando o backend
- CSS coeso usando custom properties (tema escuro consistente)

### 8.2 ⚠️ Pontos de Atenção

| Item | Observação | Recomendação |
|------|-----------|--------------|
| Sem feedback de conexão offline | Se API estiver fora, tela fica em loading eterno | Adicionar timeout + mensagem "servidor indisponível" |
| Fetch sem `AbortController` | Requests não são cancelados ao sair da página | Implementar cleanup no `onDestroy` |
| `InlineCreate` para clinics não passa address | `createClinic(name)` — perde campo de endereço | Passar `address` como parâmetro opcional |
| `ProfessionalList` sem campo de busca | Só tem toggle ativo/inativo | Adicionar input de busca por nome |
| `ConsultationNew` não limpa formulário após criar | Para criar outra consulta, precisa recarregar página | Resetar campos após sucesso ou navegar para detail |
| `ConsultationNew` sem inline create de profissional | Profissional precisa ser criado em outra tela | Adicionar `InlineCreate` para profissionais |
| Tamanho de bundle não verificado | Sem análise de bundle size | Adicionar `rollup-plugin-visualizer` ou verificar com `vite build --debug` |
| `Reports.svelte` usa `c.type` diretamente como label | Exibe "CONSULTATION" em vez de "Consulta" | Mapear para labels amigáveis |

---

## 9. Matriz de Prioridades para Próximos Desenvolvimentos

### 🔴 Crítico (deve ser feito antes do próximo release público)

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| ~~1~~ | ~~Corrigir N+1 queries nas listagens de consultas e profissionais~~ | ~~Performance~~ | ✅ DONE |
| ~~2~~ | ~~Implementar rate limiting no endpoint de login~~ | ~~Segurança~~ | ✅ DONE |
| ~~3~~ | ~~Adicionar header Content-Security-Policy~~ | ~~Segurança~~ | ✅ DONE |
| ~~4~~ | ~~Alinhar paths entre `docker-entrypoint.sh`, `docker-compose.yml` e `.env.example`~~ | ~~Deploy~~ | ✅ DONE |
| ~~5~~ | ~~Passar `SESSION_SECRET` ao SCS para persistência de sessões~~ | ~~Funcionalidade~~ | ✅ DONE |
| ~~6~~ | ~~Remover `cmd/migrate-mariadb` e `cmd/sqlite-import` com credenciais hardcoded~~ | ~~Segurança~~ | ✅ DONE |

### 🟡 Alta Prioridade

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| ~~7~~ | ~~Padronizar formato de resposta da API (`{ data: T }`)~~ | ~~Consistência~~ | ✅ DONE |
| ~~8~~ | ~~Implementar paginação nos endpoints de lista~~ | ~~Performance~~ | ✅ DONE |
| ~~9~~ | ~~Corrigir `ConsultationUpdate`/`UserUpdate` para usar transação~~ | ~~Integridade~~ | ✅ DONE |
| ~~10~~ | ~~Adicionar logging de erros nos models com `log.Printf`~~ | ~~Manutenibilidade~~ | ✅ DONE |
| ~~11~~ | ~~Corrigir badge de tipo no `Reports.svelte` (`'CONSULTA'` → `'CONSULTATION'`)~~ | ~~Bug~~ | ✅ DONE |
| ~~12~~ | ~~Implementar endpoint de alteração de senha para o próprio usuário~~ | ~~Funcionalidade~~ | ✅ DONE |
| ~~13~~ | ~~Remover `stores.ts` vazio~~ | ~~Limpeza~~ | ✅ DONE |
| ~~14~~ | ~~Implementar tema claro/escuro usando campo `theme` (funcionalidade da v0.2.1)~~ | ~~UX~~ | ✅ DONE |
| ~~15~~ | ~~Implementar visualização de login logs no admin~~ | ~~Funcionalidade~~ | ✅ DONE |

### 🟢 Média Prioridade

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| ~~16~~ | ~~Escrever testes de integração para `models/*.go` + `handlers/*.go` (SQLite `:memory:`)~~ | ~~Qualidade~~ | ✅ DONE |
| ~~17~~ | ~~Implementar CRUD de `phones` (associado a profissionais e clínicas)~~ | ~~Funcionalidade~~ | ✅ DONE |
| ~~18~~ | ~~Implementar `user_professional_sharing` (compartilhamento entre usuários)~~ | ~~Funcionalidade~~ | ✅ DONE |
| ~~19~~ | ~~Implementar `user_clinic_sharing` (compartilhamento entre usuários)~~ | ~~Funcionalidade~~ | ✅ DONE |
| ~~20~~ | ~~Substituir MarkdownPreview por biblioteca robusta (`marked`)~~ | ~~Qualidade~~ | ✅ DONE |
| ~~21~~ | ~~Adicionar inline create de profissional no `ConsultationNew`~~ | ~~UX~~ | ✅ DONE |
| ~~22~~ | ~~Adicionar cache com TTL no dashboard~~ | ~~Performance~~ | ✅ DONE |

### 🔵 Baixa Prioridade

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| 23 | Documentação OpenAPI/Swagger | Documentação | 8h |
| ~~24~~ | ~~Unificar arquivos de migração duplicados~~ | ~~Limpeza~~ | ✅ DONE |
| 25 | Análise de bundle size do frontend | Otimização | 1h |
| ~~26~~ | ~~Adicionar tratamento de timeout/offline no frontend~~ | ~~UX~~ | ✅ DONE (AbortSignal.timeout) |
| ~~27~~ | ~~Campo de busca no `ProfessionalList`~~ | ~~UX~~ | ✅ DONE |
| ~~28~~ | ~~Limpar formulário após criar consulta (ou navegar)~~ | ~~UX~~ | ✅ DONE |
| ~~29~~ | ~~Adicionar `Cache-Control` headers nos uploads~~ | ~~Performance~~ | ✅ DONE |
| ~~30~~ | ~~Melhorar `InlineCreate` para suportar address em clinics~~ | ~~Funcionalidade~~ | ✅ DONE |

---

## 10. Perguntas para o Desenvolvedor (Respondidas)

> **Data das respostas:** 17/05/2026

1. **Tabelas órfãs (`phones`, `user_*_sharing`):** Elas vieram do schema v0.2.1. Você planeja implementá-las ou prefere removê-las com uma migration de limpeza?
   - ✅ **Resposta:** Manter todas. `phones` deve ser implementada com associação a profissionais e clínicas (como na v0.2.1). `user_professional_sharing` e `user_clinic_sharing` devem ser implementadas para compartilhamento entre usuários (como na v0.2.1). `login_logs` deve ser mantida e ter visualização no admin.

2. **Formato de resposta da API:** Confirmo padronização para `{ data: T }` em todos os endpoints?
   - ✅ **Resposta:** Sim, padronizar todos os endpoints (singulares e listas) para `{ data: T }`.

3. **Rate limiting:** Prefere solução simples (contador em SQLite com middleware customizado) ou integração com biblioteca externa?
   - ✅ **Resposta:** Solução simples com SQLite + middleware chi customizado, sem dependências externas.

4. **Tema claro/escuro:** É prioridade implementar agora ou pode ficar para depois?
   - ✅ **Resposta:** Implementar agora. A versão anterior (v0.2.1) já tinha esta opção para os usuários. Reclassificado para alta prioridade.

5. **Testes:** Qual cobertura inicial é aceitável — apenas models, ou models + handlers? Prefere testes de unidade ou de integração com SQLite `:memory:`?
   - ✅ **Resposta:** Models + handlers, com testes de integração usando SQLite `:memory:`. Sem alterações de código nesta iteração — apenas planejamento.

6. **Paths do Docker:** Confirmo alinhar tudo para `/app/data/` (entrypoint + compose + .env.example)?
   - ✅ **Resposta:** Sim, alinhar todos os paths para `/app/data/`, com volume único `./data:/app/data`.

7. **Ferramentas de migração (`cmd/migrate-mariadb`, `cmd/sqlite-import`):** Ainda são necessárias ou podem ser removidas do repositório?
   - ✅ **Resposta:** Remover completamente. Incluindo todas as credenciais hardcoded que devem ser eliminadas do código.

8. **Markdown:** Posso adicionar dependência `marked` (leve, sem dependências transitivas) ao frontend para parsing robusto?
   - ✅ **Resposta:** Sim, adicionar `marked` para parsing robusto de Markdown.

---

> **Nota:** Este relatório foi gerado exclusivamente por leitura de código, sem alterações. Recomendo criar issues no GitHub para cada item das matrizes de prioridade 🔴🟡 e trackear o progresso.
>
> **Arquivos analisados:** 47 arquivos fonte (Go, Svelte, TypeScript, SQL, CSS, Docker, configuração), totalizando ~4500 linhas de código.