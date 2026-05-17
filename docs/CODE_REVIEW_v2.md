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

#### A. SESSION_SECRET não utilizado pelo SCS

`.env.example` define `SESSION_SECRET`, o Unraid o injeta corretamente, mas `internal/auth/session.go` **nunca lê essa variável**. O SCS gerará uma chave de criptografia aleatória a cada restart do processo.

- **Impacto:** Todas as sessões são invalidadas a cada deploy/restart do container. Usuários são deslogados.
- **Recomendação:** Passar `SESSION_SECRET` ao inicializar o SCS, ou documentar explicitamente que sessões são voláteis por design.

#### B. Divergência de paths entre docker-entrypoint.sh e docker-compose.yml

O `docker-entrypoint.sh` cria diretórios em `/app/data/`:
```sh
DATA_DIR="/app/data"
DB_DIR="${DATA_DIR}/db"
UPLOADS_DIR="${DATA_DIR}/uploads"
```

O `docker-compose.yml` referencia `/data/` (sem `/app`):
```yaml
DATABASE_URL: file:/data/db/medlog.sqlite
FILES_PATH: /data/uploads
volumes:
  - ./data/db:/data/db
  - ./data/uploads:/data/uploads
```

O `.env.example` também usa `/data/`:
```env
DATABASE_URL=file:/data/db/medlog.sqlite
FILES_PATH=/data/uploads
```

- **Impacto:** Quem usar `docker-compose.yml` sem customizar as variáveis terá erro, pois os diretórios `/data/db` e `/data/uploads` **não são criados pelo entrypoint** (ele só cria `/app/data/*`). O SQLite falhará ao tentar criar o banco se o diretório pai não existir. O Unraid só funciona porque você alinhou manualmente os paths para `/app/data`.
- **Recomendação:** Alinhar entrypoint e compose para o mesmo path base. **Opção recomendada:** usar `/app/data` em tudo — entrypoint já cria os subdiretórios, e um volume único simplifica a configuração:

```yaml
# docker-compose.yml (corrigido)
environment:
  DATABASE_URL: file:/app/data/db/medlog.sqlite
  FILES_PATH: /app/data/uploads
volumes:
  - ./data:/app/data
```

```env
# .env.example (corrigido)
DATABASE_URL=file:/app/data/db/medlog.sqlite
FILES_PATH=/app/data/uploads
```

#### C. Duplicação de arquivos de migração

```
migrations/001_initial_schema.sql          ← "source of truth" versionado
internal/migrations/001_initial_schema.sql ← embedded (usado pelo goose)
```

Apenas `internal/migrations/` é efetivamente usado pelo goose em runtime. A duplicação gera risco de divergência silenciosa.

- **Impacto:** Se alguém editar apenas `migrations/`, a mudança não será aplicada.
- **Recomendação:** Manter apenas `internal/migrations/` como fonte única, ou usar `go:generate` para copiar, ou um symlink.

#### D. Padrão de resposta inconsistente na API

| Endpoint | Formato de resposta |
|----------|-------------------|
| `POST /auth/signin` | `{ id, email, name, role }` (objeto direto) |
| `GET /auth/me` | `{ id, email, name, role }` (objeto direto) |
| `GET /dashboard` | Objeto direto |
| `GET /consultations` | `{ data: [...] }` |
| `POST /consultations` | Objeto direto |
| `GET /specialties` | `{ data: [...] }` |
| `POST /specialties` | Objeto direto |
| `GET /professionals` | `{ data: [...] }` |
| `POST /professionals` | Objeto direto |
| `GET /admin/stats` | Objeto direto |
| `GET /admin/consultations` | `{ data: [...] }` |

Metade dos endpoints retorna o objeto diretamente, a outra metade envolve em `{ data: ... }`. O frontend (`api.ts`) já lida com ambos formatos, mas é frágil.

- **Recomendação:** Padronizar. **Opção recomendada:** `{ data: T }` para todos os endpoints, pois permite adicionar metadados (paginação, erros estruturados) sem quebrar compatibilidade.

#### E. Geração de IDs inconsistente

- `models/professional.go` define função `newID()` → `uuid.New().String()`
- Todos os handlers chamam `uuid.New().String()` diretamente
- `newID()` só é usada dentro do próprio `professional.go`

- **Recomendação:** Remover `newID()` e usar `uuid.New().String()` consistentemente em todo o código.

#### F. Arquivo `stores.ts` vazio

`frontend/src/lib/stores.ts` contém apenas `export {}`. Código morto.

- **Recomendação:** Remover o arquivo ou populá-lo com stores reais.

#### G. Bug no Reports.svelte — badge de tipo sempre amarelo

```svelte
<span class="badge {c.type === 'CONSULTA' ? 'badge-blue' : 'badge-yellow'}">{c.type}</span>
```

O valor real de `c.type` é `'CONSULTATION'` (definido no backend), **não** `'CONSULTA'`. Como a comparação nunca é verdadeira, o badge sempre fica amarelo.

- **Recomendação:** Corrigir para `c.type === 'CONSULTATION'`.

---

## 3. Segurança e Vulnerabilidades

### 3.1 🔴 Críticos

#### A. Ausência de rate limiting no login

`POST /auth/signin` não tem proteção contra brute-force. Um atacante pode tentar senhas indefinidamente sem bloqueio.

- **Risco:** Alto — comprometimento de contas por força bruta
- **Recomendação:** Implementar rate limiting com chi middleware. Exemplo: bloquear após 5 tentativas em 1 minuto por IP, com delay progressivo. Alternativa: usar biblioteca como `didip/tollbooth` ou implementar contador no SQLite com limpeza periódica.

#### B. Ausência de Content-Security-Policy

`internal/middleware/security.go` define headers de segurança básicos mas **não inclui CSP**:

```go
w.Header().Set("X-Content-Type-Options", "nosniff")
w.Header().Set("X-Frame-Options", "DENY")
w.Header().Set("X-XSS-Protection", "1; mode=block")
w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
// FALTA: Content-Security-Policy
```

- **Risco:** Médio-alto — sem CSP, XSS tem impacto maior (embora o MarkdownPreview já faça HTML escaping)
- **Recomendação:** Adicionar:
```go
w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'")
```

### 3.2 🟡 Médios

#### C. `ConsultationUpdate` e `UserUpdate` — múltiplos updates sem transação

```go
// Cada campo gera um UPDATE separado e independente
if in.Date != nil {
    db.ExecContext(ctx, "UPDATE consultations SET date=?, updated_at=? WHERE id=?", ...)
}
if in.Proposito != nil {
    db.ExecContext(ctx, "UPDATE consultations SET proposito=?, updated_at=? WHERE id=?", ...)
}
if in.Notes != nil {
    db.ExecContext(ctx, "UPDATE consultations SET notes=?, updated_at=? WHERE id=?", ...)
}
// ... até 6 UPDATEs separados para uma única operação
```

- **Risco:** Race condition (outro request pode ler estado intermediário); falha parcial deixa dados inconsistentes
- **Recomendação:** Construir uma única query UPDATE com `SET` dinâmico e executar em uma transação. Exemplo:

```go
tx, _ := db.BeginTx(ctx, nil)
defer tx.Rollback()
// construir query dinâmica com todos os campos alterados
// executar único UPDATE
tx.Commit()
```

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

#### E. Credenciais hardcoded no migrador MariaDB

`cmd/migrate-mariadb/main.go`:
```go
dsn := "medlog:medlog@tcp(192.168.1.10:3333)/medlog?parseTime=true&charset=utf8mb4"
```

- **Risco:** Credenciais e IP interno visíveis no repositório público
- **Recomendação:** Mover para variáveis de ambiente. Se a ferramenta for de uso único (migração já concluída), remover do repositório.

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

### 4.1 🔴 Problemas N+1 (Crítico para performance)

#### A. Listagem de consultas: N+1 queries

```go
func consultationBase(...) ([]Consultation, error) {
    // 1 query para buscar consultas
    rows, _ := db.QueryContext(ctx, "SELECT ... FROM consultations ...")
    for rows.Next() {
        // +1 query POR CONSULTA para buscar professional
        c.Professional, _ = ProfessionalFindByID(ctx, db, *c.ProfessionalID)
        // +1 query POR CONSULTA para buscar files
        c.Files, _ = FileFindByConsultationID(ctx, db, c.ID)
        // Files, por sua vez, faz +1 query POR ARQUIVO para categories
    }
}
```

**100 consultas com 2 arquivos cada = 1 + 100 + 100 + (100×2) = 401 queries**

- **Recomendação:**
  1. Fazer JOIN na query principal para trazer dados do professional
  2. Batch load de files: `SELECT * FROM files WHERE consultation_id IN (?, ?, ...)`
  3. Batch load de categorias: `SELECT ... FROM file_file_categories WHERE file_id IN (...)`

#### B. Listagem de profissionais: N+1 para specialties

```go
for rows.Next() {
    p.Specialties, _ = professionalLoadSpecialties(ctx, db, p.ID) // +1 query
}
```

**50 profissionais = 51 queries**

- **Recomendação:** JOIN com `GROUP_CONCAT` no SQLite, ou batch load após o loop principal.

### 4.2 🟡 Performance Geral

#### C. Dashboard — 8+ queries sequenciais

O dashboard executa 8 queries individuais em sequência. Para datasets <10k registros não é crítico, mas cada query é uma round-trip ao banco.

- **Recomendação:** Agrupar queries relacionadas (ex: summary com uma única query usando UNION ALL). Implementar cache com TTL de 5 minutos no backend.

#### D. Sem paginação em nenhum endpoint

Nenhum endpoint de lista suporta paginação (`?page=1&limit=20`). Com 1000+ registros, a listagem fica lenta no backend e pesada no frontend.

- **Recomendação:** Implementar paginação em `/consultations`, `/professionals`, `/admin/consultations`, `/admin/professionals`, `/admin/files`.

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
| `login_logs` | ✅ Definida | ✅ INSERT no SignIn | ❌ Sem visualização |

- **`phones`**: Tabela existe desde v0.2.1 mas nunca foi implementada.
- **`user_*_sharing`**: Compartilhamento entre usuários — funcionalidade planejada mas não implementada.
- **`login_logs`**: Dados são coletados mas não há tela no admin para visualizá-los.

- **Recomendação:**
  - `phones`: implementar CRUD ou remover tabela com migration de limpeza
  - `user_*_sharing`: decidir se será implementado na v2 ou adiado; se adiado, remover do schema atual
  - `login_logs`: adicionar aba "Logs de Acesso" no painel admin

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
| **Telefones de profissionais/clínicas** | ❌ |
| **Compartilhamento entre usuários** | ❌ |
| **Alteração de senha pelo próprio usuário** | ❌ |
| **Visualização de login logs** | ❌ |
| **Tema do usuário (claro/escuro)** | ❌ (campo existe, não usado) |
| **Inline create de profissional na criação de consulta** | ❌ |

### 5.3 Campo "theme" não utilizado

A tabela `users` tem coluna `theme` (valores: SYSTEM, LIGHT, DARK), mas:
- O frontend só tem tema escuro (hardcoded em `app.css`)
- Não há endpoint para o usuário alterar o próprio tema
- `auth.ts` não expõe o tema na store

- **Recomendação:** Implementar toggle de tema ou remover o campo do schema. Se implementar, usar CSS custom properties e media query `prefers-color-scheme` para o valor SYSTEM.

---

## 6. Tratamento de Erros

### 6.1 Erros silenciados (ignorados com `_`)

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

### 7.2 Logs Insuficientes

Apenas o middleware `Logger` do chi gera logs de requests HTTP. Não há logging de:
- Erros de banco de dados (detalhe real, não só "db error")
- Falhas de upload de arquivos
- Operações de delete (consultas, profissionais, arquivos)
- Restauração de backup
- Tentativas de login falhas (importante para segurança)

- **Recomendação:** Adotar `log/slog` (Go 1.21+) com níveis estruturados. Incluir logs em pontos críticos.

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
| 1 | Corrigir N+1 queries nas listagens de consultas e profissionais | Performance | 4h |
| 2 | Implementar rate limiting no endpoint de login | Segurança | 2h |
| 3 | Adicionar header Content-Security-Policy | Segurança | 30min |
| 4 | Alinhar paths entre `docker-entrypoint.sh`, `docker-compose.yml` e `.env.example` | Deploy | 30min |
| 5 | Passar `SESSION_SECRET` ao SCS para persistência de sessões | Funcionalidade | 1h |
| 6 | Remover credenciais hardcoded do `cmd/migrate-mariadb` | Segurança | 15min |

### 🟡 Alta Prioridade

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| 7 | Padronizar formato de resposta da API (`{ data: T }`) | Consistência | 3h |
| 8 | Implementar paginação nos endpoints de lista | Performance | 4h |
| 9 | Corrigir `ConsultationUpdate`/`UserUpdate` para usar transação | Integridade | 2h |
| 10 | Adicionar logging de erros nos models com `log.Printf` | Manutenibilidade | 2h |
| 11 | Corrigir badge de tipo no `Reports.svelte` (`'CONSULTA'` → `'CONSULTATION'`) | Bug | 5min |
| 12 | Implementar endpoint de alteração de senha para o próprio usuário | Funcionalidade | 1h |
| 13 | Remover `stores.ts` vazio | Limpeza | 1min |

### 🟢 Média Prioridade

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| 14 | Escrever testes unitários para `models/*.go` | Qualidade | 8h |
| 15 | Resolver tabelas órfãs (`phones`, `sharing`) — implementar ou remover | Funcionalidade | 2h-8h |
| 16 | Adicionar visualização de login logs no admin | Funcionalidade | 2h |
| 17 | Implementar tema claro/escuro usando campo `theme` | UX | 4h |
| 18 | Substituir MarkdownPreview por biblioteca robusta (`marked`) | Qualidade | 2h |
| 19 | Adicionar inline create de profissional no `ConsultationNew` | UX | 2h |
| 20 | Adicionar cache com TTL no dashboard | Performance | 2h |

### 🔵 Baixa Prioridade

| # | Item | Categoria | Esforço |
|---|------|-----------|---------|
| 21 | Documentação OpenAPI/Swagger | Documentação | 8h |
| 22 | Unificar arquivos de migração duplicados | Limpeza | 30min |
| 23 | Análise de bundle size do frontend | Otimização | 1h |
| 24 | Adicionar tratamento de timeout/offline no frontend | UX | 3h |
| 25 | Campo de busca no `ProfessionalList` | UX | 1h |
| 26 | Limpar formulário após criar consulta (ou navegar) | UX | 30min |
| 27 | Adicionar `Cache-Control` headers nos uploads | Performance | 15min |
| 28 | Melhorar `InlineCreate` para suportar address em clinics | Funcionalidade | 1h |

---

## 10. Perguntas para o Desenvolvedor

Para alinhar expectativas antes de iniciar as correções:

1. **Tabelas órfãs (`phones`, `user_*_sharing`):** Elas vieram do schema v0.2.1. Você planeja implementá-las ou prefere removê-las com uma migration de limpeza?

2. **Formato de resposta da API:** Confirmo padronização para `{ data: T }` em todos os endpoints?

3. **Rate limiting:** Prefere solução simples (contador em SQLite com middleware customizado) ou integração com biblioteca externa?

4. **Tema claro/escuro:** É prioridade implementar agora ou pode ficar para depois?

5. **Testes:** Qual cobertura inicial é aceitável — apenas models, ou models + handlers? Prefere testes de unidade ou de integração com SQLite `:memory:`?

6. **Paths do Docker:** Confirmo alinhar tudo para `/app/data/` (entrypoint + compose + .env.example)?

7. **Ferramentas de migração (`cmd/migrate-mariadb`, `cmd/sqlite-import`):** Ainda são necessárias ou podem ser removidas do repositório?

8. **Markdown:** Posso adicionar dependência `marked` (leve, sem dependências transitivas) ao frontend para parsing robusto?

---

> **Nota:** Este relatório foi gerado exclusivamente por leitura de código, sem alterações. Recomendo criar issues no GitHub para cada item das matrizes de prioridade 🔴🟡 e trackear o progresso.
>
> **Arquivos analisados:** 47 arquivos fonte (Go, Svelte, TypeScript, SQL, CSS, Docker, configuração), totalizando ~4500 linhas de código.