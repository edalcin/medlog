# Documentação Técnica — MedLog v3

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Go 1.25 |
| Router | go-chi/chi v5 |
| Sessões | alexedwards/scs v2 (armazenadas no SQLite) |
| Migrações | pressly/goose v3 |
| Banco | SQLite via modernc.org/sqlite (pure-Go, CGO_ENABLED=0) |
| Frontend | Svelte 5 + Vite 5 + TypeScript |
| Roteamento SPA | @keenmate/svelte-spa-router |
| Markdown | marked v18 |
| IA (opcional) | Google Gemini via REST, escrito só com `net/http` e `encoding/json` |
| Deploy | Docker multi-stage (alpine:3.21, ~30MB imagem final) |

O frontend é compilado em tempo de build e embutido no binário Go via `//go:embed`. O resultado é um único executável sem dependências externas além do SQLite.

---

## Arquitetura

```
┌─────────────────────────────────────────┐
│           Browser                       │
│   Svelte 5 SPA (embutido no binário)    │
└───────────────────┬─────────────────────┘
                    │ HTTP/JSON
┌───────────────────▼─────────────────────┐
│           Go Binary (:3000)             │
│                                         │
│  chi router                             │
│  ├── /api/*   → handlers/               │
│  ├── /api/files/* → serve uploads       │
│  └── /*       → embed/dist (SPA)        │
│                                         │
│  alexedwards/scs (sessions em SQLite)   │
│  DashboardHandler (cache 5min sync.Map) │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│     SQLite (WAL, foreign keys on)       │
│     + volume de uploads (arquivos)      │
└─────────────────────────────────────────┘
```

---

## Estrutura do Projeto

```
cmd/medlog/main.go              # Entry point — wiring de handlers e rotas
internal/
  auth/
    session.go                  # SCS session manager + rotação de SESSION_SECRET
    middleware.go               # RequireAuth, RequireAdmin
  db/
    db.go                       # sql.Open + PRAGMA WAL + foreign keys
    migrate.go                  # goose executa migrations no startup
    testhelper.go               # SetupTestDB(:memory:) para testes
    migrate_test.go             # Up/Down de cada migração, catálogo com 55 linhas
    migrate009_test.go          # 78 Faixas de normalidade: sem empate de especificidade (sexo × idade 18–100)
  handlers/                     # Handlers HTTP por domínio
    auth.go                     # SignIn, SignOut, Me
    consultations.go
    professionals.go
    clinics.go
    specialties.go
    categories.go
    files.go
    phones.go                   # CRUD telefones de profissionais/clínicas
    sharing.go                  # Compartilhamento entre usuários
    users.go                    # CRUD usuários + /me (perfil) + /me/password + /me/theme + /others
    admin.go                    # Admin: stats, bulk-delete, backup/restore, login-logs
    extractions.go              # Extração por IA: disparo, status, revisão, confirmar/rejeitar
    series.go                   # Série temporal de indicadores + Faixa de normalidade (rotas de usuário, não de admin)
    dashboard.go                # Dashboard com cache TTL 5min
    helpers.go                  # parsePagination, writeJSON, writePagedJSON, writeDBError
    auth_test.go
    consultations_test.go
    professionals_test.go
    files_test.go
    files_upload_test.go
    dashboard_test.go
    users_me_test.go            # PATCH /users/me: guarda de senha só na troca real de e-mail, date() no nascimento
    extractions_test.go         # Extração contra provedor falso (httptest)
    review_test.go              # Revisão, confirmação em bloco, não-duplicação, contrato unmapped nunca null
    series_test.go              # Série: só confirmed, escopo por usuário
  middleware/
    security.go                 # CSP, X-Frame-Options, HSTS, nosniff
    ratelimit.go                # Rate limiting SQLite (5 req/min/IP) para /auth/signin
  gemini/
    gemini.go                   # Cliente Gemini: PDF inline, responseSchema, contagem de tokens
  models/                       # Funções SQL (sem ORM)
    user.go                     # inclui biological_sex/birth_date, sempre lido com date()
    consultation.go
    professional.go
    clinic.go
    specialty.go
    file.go
    phone.go                    # PhoneFindBy*, PhoneCreate, PhoneBelongsToUser
    sharing.go                  # ProfessionalSharing*, ClinicSharing*
    login_log.go                # LoginLogFindAll
    health.go                   # Indicator*, Observation*, Extraction* (v3.0)
    normalrange.go              # NormalRangeResolve: casa Característica do usuário contra indicator_normal_ranges (v3.1)
    appconfig.go                # ConfigGet/ConfigSet sobre app_config
    helpers.go                  # inClause, anySlice (batch queries)
    user_test.go
    consultation_test.go
    professional_test.go
    health_test.go              # dedup por procedência na leitura (ADR 0013)
    normalrange_test.go         # resolução por especificidade, empate não desenha banda
  embed/                        # Build do Svelte embutido
  migrations/                   # SQL embutidos para goose (fonte canônica)
    001_initial_schema.sql
    002_add_sessions.sql
    003_rate_limiting_and_config.sql
    004_login_logs_extended.sql
    005_fix_datetime_format.sql
    006_file_hash_index.sql
    007_health_indicators.sql   # Catálogo + observações + extrações (v3.0)
    008_normal_ranges.sql       # users.biological_sex/birth_date + indicator_normal_ranges vazia (v3.1)
    009_seed_normal_ranges.sql  # Semeia 78 Faixas de normalidade com fonte citada (v3.1)
    migrations.go               # //go:embed *.sql
frontend/
  src/lib/api.ts                # Cliente API tipado (todos os endpoints)
  src/lib/auth.ts                # Stores + setTheme + signout
  src/lib/date.ts                # Formatação de data pt-BR reaproveitada pelo Chart.js
  src/routes/
    Dashboard.svelte
    ConsultationList.svelte
    ConsultationNew.svelte      # Inline create de profissional
    ConsultationDetail.svelte
    ProfessionalList.svelte     # Busca por nome + filtro ativo
    ProfessionalDetail.svelte   # CRUD + phones + specialties + clinic
    Sharing.svelte              # Gerenciar compartilhamento com outros usuários
    Reports.svelte
    Admin.svelte                # Tabs admin, incluindo login logs e "Extração por IA"
    Files.svelte                # Lista de documentos + disparo de extração
    ExtractionReview.svelte     # Revisão em bloco ao lado do PDF
    HealthSeries.svelte         # Série temporal em Chart.js, banda de Faixa de normalidade, clique abre o Laudo
    Config.svelte                # Perfil: nome, e-mail, senha, sexo biológico, nascimento
    SignIn.svelte
  src/components/
    Navigation.svelte           # Ciclo de tema SYSTEM/LIGHT/DARK
    FileUpload.svelte
    FileAttachModal.svelte
    FileEditModal.svelte
    CategorySelect.svelte
    StarRating.svelte
    TipTapEditor.svelte
    InlineCreate.svelte         # Suporta specialties, clinics (c/ address), professionals
    MarkdownPreview.svelte      # marked.parse()
```

---

## Schema do Banco de Dados

```
users
  id, email, username, name, password_hash
  role (ADMIN|USER), theme (SYSTEM|LIGHT|DARK)
  biological_sex (M|F, nullable), birth_date (DATE, nullable)   # v3.1 — Característica do usuário, resolve a Faixa de normalidade
  created_at, updated_at

specialties
  id, name UNIQUE, created_at

clinics
  id, name, address, user_id → users, created_at, updated_at
  UNIQUE(name, user_id)

professionals
  id, name, crm, address, notes, is_active
  user_id → users, clinic_id → clinics, created_at, updated_at

professional_specialties
  id, professional_id → professionals, specialty_id → specialties, created_at
  UNIQUE(professional_id, specialty_id)

phones
  id, number, label
  professional_id → professionals (nullable)
  clinic_id → clinics (nullable)
  created_at

user_professional_sharing
  id, sharing_from_user_id → users, sharing_to_user_id → users, created_at
  UNIQUE(sharing_from_user_id, sharing_to_user_id)

user_clinic_sharing
  id, sharing_from_user_id → users, sharing_to_user_id → users, created_at
  UNIQUE(sharing_from_user_id, sharing_to_user_id)

consultations
  id, date, proposito, notes (Markdown), type (CONSULTATION|EVENT), rating (1-5)
  user_id → users, professional_id → professionals, created_at, updated_at

file_categories
  id, name UNIQUE, created_at

files
  id, filename, custom_name, path, mime_type, size, hash
  consultation_id → consultations, professional_id → professionals
  user_id → users, uploaded_at
  collected_at, lab_name, report_number    # v3.0 — preenchidos pela Extração, nunca por cima de valor humano
  UNIQUE(user_id, hash)                    # deduplicação de upload

file_file_categories
  id, file_id → files, category_id → file_categories, created_at
  UNIQUE(file_id, category_id)

login_logs
  id, user_id → users, timestamp, ip_address, user_agent

rate_limit_attempts
  ip TEXT, window_start TEXT, attempts INT
  UNIQUE(ip, window_start)

app_config
  key TEXT PRIMARY KEY, value TEXT

health_indicators                          # v3.0 — catálogo global, sem user_id
  id, code UNIQUE, name, unit, created_at

extractions                                # v3.0 — uma linha por envio ao provedor de IA
  id, user_id → users, file_id → files, triggered_by → users
  model, prompt_version, schema_version
  status (pending|succeeded|failed), raw_response
  input_tokens, output_tokens, error
  consented_at, created_at, finished_at

health_observations                        # v3.0 — uma medição de um Indicador
  id, user_id → users, indicator_id → health_indicators
  source_file_id → files, extraction_id → extractions
  collected_at, value_text NOT NULL, value_num NULL, unit
  reference_text, ref_min, ref_max, out_of_range
  provenance (primary|evolutive), status (review|confirmed), created_at
  INDEX(user_id, indicator_id, collected_at)                        # a consulta da série
  UNIQUE(user_id, indicator_id, collected_at, provenance)           # reextrair substitui, não duplica

indicator_normal_ranges                    # v3.1 — Faixa de normalidade, distinta da faixa impressa no laudo
  id, indicator_id → health_indicators
  sex (M|F, nullable = qualquer), age_min, age_max (nullable = sem piso/teto)
  min, max (nullable = sem banda, mas a faixa ainda existe como texto)
  text NOT NULL, source NOT NULL                                    # citação obrigatória, nunca inventada

sessions                        # gerenciado pelo alexedwards/scs
  token, data, expiry
```

**Cascade deletes:**
- `users` delete → cascata em `consultations`, `professionals`, `clinics`, `files`, `phones` (via profissional/clínica), `login_logs`
- `consultations` delete → cascata em `files`
- `professionals` delete → cascata em `professional_specialties`, `phones`
- `clinics` delete → SET NULL em `professionals.clinic_id`; cascata em `phones`
- `users` delete → cascata também em `health_observations` e `extractions`

**Formato de datetime:** todo valor gravado pelo Go usa `_time_format=sqlite`, que produz `YYYY-MM-DD HH:MM:SS+00:00`. O índice único de Observações compara `collected_at` como texto: um caminho de código que grave em outro formato passa a duplicar em silêncio. Há teste protegendo isso (`TestReview_ReExtractionDoesNotDuplicate`).

---

## Rotas da API

### Autenticação pública
```
POST   /api/auth/signin          Rate-limited (5 req/min/IP)
POST   /api/auth/signout
```

### Autenticadas (RequireAuth)
```
GET    /api/auth/me
GET    /api/users/others         Lista outros usuários (id+nome) para sharing
PUT    /api/users/me/password    Alterar própria senha (verifica senha atual)
PATCH  /api/users/me/theme       Alterar tema (LIGHT|DARK|SYSTEM)
PATCH  /api/users/me             Próprio perfil: nome, e-mail, sexo biológico, nascimento.
                                 Senha atual só é exigida quando o e-mail muda de verdade

GET    /api/dashboard

GET    /api/specialties
GET    /api/file-categories

GET    /api/clinics
POST   /api/clinics
PUT    /api/clinics/{id}
DELETE /api/clinics/{id}
GET    /api/clinics/{id}/phones
POST   /api/clinics/{id}/phones

GET    /api/professionals
POST   /api/professionals
GET    /api/professionals/{id}
PUT    /api/professionals/{id}
DELETE /api/professionals/{id}
GET    /api/professionals/{id}/phones
POST   /api/professionals/{id}/phones

PUT    /api/phones/{id}
DELETE /api/phones/{id}

GET    /api/consultations
POST   /api/consultations
GET    /api/consultations/{id}
PUT    /api/consultations/{id}
DELETE /api/consultations/{id}

GET    /api/files                Lista os próprios documentos (traz estado da extração)
POST   /api/files
GET    /api/files/{filename}     Cache-Control: private, max-age=3600
PATCH  /api/files/{id}
DELETE /api/files/{id}

GET    /api/health-series        Indicadores com Observação confirmada do usuário
GET    /api/health-series/{code} Série do Indicador e Faixa de normalidade: {observations, normalRange}

POST   /api/extractions          Exige consent: true; responde 202 com a linha pending
GET    /api/extractions/{id}     Alvo do polling: a chamada dura mais que o timeout de 30s
GET    /api/extractions/{id}/observations
GET    /api/extractions/{id}/review     Observações + pendências + metadados sugeridos
POST   /api/extractions/{id}/confirm    Confirma o bloco e grava metadados vazios de files
POST   /api/extractions/{id}/reject     Descarta Observações, preserva a Extração
GET    /api/files/{id}/extractions
DELETE /api/files/{id}/extractions      Zera o documento: apaga extrações e Observações
GET    /api/health-indicators

GET    /api/sharing/professionals
POST   /api/sharing/professionals
DELETE /api/sharing/professionals/{userId}
GET    /api/sharing/clinics
POST   /api/sharing/clinics
DELETE /api/sharing/clinics/{userId}
```

### Administração (RequireAdmin)
```
POST   /api/specialties
PUT    /api/specialties/{id}
DELETE /api/specialties/{id}

POST   /api/file-categories
PUT    /api/file-categories/{id}
DELETE /api/file-categories/{id}

GET    /api/users
POST   /api/users
GET    /api/users/{id}
PUT    /api/users/{id}
PUT    /api/users/{id}/password
DELETE /api/users/{id}

GET    /api/admin/stats
GET    /api/admin/consultations
POST   /api/admin/consultations/bulk-delete
GET    /api/admin/professionals
POST   /api/admin/professionals/bulk-delete
GET    /api/admin/files
GET    /api/admin/login-logs
GET    /api/admin/backup
POST   /api/admin/restore

GET    /api/admin/gemini-model   Modelo atual + lista curada + se a chave está presente
PUT    /api/admin/gemini-model

POST   /api/health-indicators    Promove analito pendente ao catálogo (catálogo é global)
```

---

## Desenvolvimento Local

### Pré-requisitos

- Go 1.25+
- Node.js 20+

### Setup

```bash
# Clone
git clone https://git.dalc.in/edalcin/medlog.git
cd medlog

# Backend
cp .env.example .env   # edite conforme necessário
go run ./cmd/medlog

# Frontend (hot reload em :5173, proxies /api → :3000)
cd frontend
npm install
npm run dev
```

### Variáveis de ambiente (`.env`)

```env
DATABASE_URL=file:./data/medlog.sqlite
FILES_PATH=./data/uploads
SESSION_SECRET=gere_com_openssl_rand_base64_32
PORT=3000
ADMIN_EMAIL=admin@exemplo.com
ADMIN_PASSWORD=senha_forte
SESSION_SECURE=false
TRUST_PROXY=false
GEMINI_API_KEY=            # opcional — habilita a extração por IA
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | sim | Caminho para o SQLite (`file:` prefix obrigatório) |
| `FILES_PATH` | sim | Diretório de uploads |
| `SESSION_SECRET` | sim | Chave de 32+ chars. Rotacionar invalida todas as sessões |
| `PORT` | não | Porta do servidor (padrão: `3000`) |
| `ADMIN_EMAIL` | primeiro boot | Email do admin inicial |
| `ADMIN_PASSWORD` | primeiro boot | Senha do admin inicial |
| `SESSION_SECURE` | não | `true` em produção (HTTPS). Padrão: `false` |
| `TRUST_PROXY` | não | `true` se atrás de proxy reverso (ativa X-Forwarded-For para rate limiting) |
| `GEMINI_API_KEY` | não | Chave do Google AI Studio. Ausente, a extração por IA fica desabilitada e o resto funciona igual. Nunca é gravada no banco |

### Comandos

```bash
# Backend
go run ./cmd/medlog       # dev server em :3000
go build ./...            # verificar compilação
go test ./...             # testes de integração

# Frontend
cd frontend
npm run dev               # hot reload em :5173
npm run build             # build → internal/embed/dist/

# Docker
docker build -t medlog:local .
docker compose up
```

---

## Autenticação e Sessões

- Credenciais email + bcrypt — sem OAuth
- Sessões server-side via `alexedwards/scs` armazenadas no SQLite
- `SESSION_SECRET`: hash SHA256 armazenado em `app_config`; se mudar, todas as sessões são invalidadas automaticamente
- Roles: `ADMIN` (acesso global) e `USER` (acesso aos próprios dados)
- Rate limiting: 5 tentativas/minuto por IP no `POST /auth/signin`; retorna 429 + `Retry-After: 60`
- Login registrado em `login_logs` com IP e user-agent

---

## Compartilhamento entre Usuários

Um usuário pode compartilhar seus profissionais e/ou clínicas com outros usuários:

- Gerenciado em `/sharing` (página acessível a qualquer usuário)
- Profissionais/clínicas compartilhados aparecem na lista do destinatário com badge "Compartilhado" e são somente leitura
- Tabelas: `user_professional_sharing`, `user_clinic_sharing`
- `GET /api/professionals` usa UNION ALL para combinar próprios + compartilhados
- `GET /api/users/others` retorna `[{id, name}]` para seleção de destinatários

---

## Tema do Usuário

- Valores: `SYSTEM` (usa media query do OS), `LIGHT`, `DARK`
- Persistido na coluna `theme` da tabela `users` e na sessão
- Frontend: `App.svelte` aplica `data-theme="light|dark"` em `<html>`; SYSTEM remove o atributo
- `app.css` usa `:root,[data-theme="dark"]` para dark, `[data-theme="light"]` e `@media (prefers-color-scheme: light)` para light

---

## Upload de Arquivos

- Tipos aceitos: PDF, PNG, JPG (max 10MB)
- Filename: `{uuid}.{ext}` — nunca expõe nome original no filesystem
- Caminho: `{FILES_PATH}/{uuid}.{ext}`
- Acesso via: `GET /api/files/{filename}` (requer autenticação)
- Cache-Control: `private, max-age=3600` — UUIDs são imutáveis

---

## Extração de Indicadores por IA (v3.0)

Extrai os valores de um PDF de laudo **já anexado** ao sistema e os transforma em Observações de Indicadores. Não há upload no caminho da extração.

### Fluxo

1. `POST /api/extractions` com `consent: true`. Sem consentimento explícito nada é enviado — o pedido morre em 400. Quem dispara é o dono do documento; o `ADMIN` dispara em qualquer um. Documento alheio responde **404**, nunca 403 (ADR 0011).
2. A linha nasce em `extractions` com `status = pending` **antes** da chamada: uma queda no meio deixa evidência, não silêncio.
3. A chamada roda em goroutine com `context.Background()`, fora de qualquer transação. O cliente desistir não cancela o que já está sendo cobrado.
4. `raw_response` e os contadores de token são gravados **antes** de qualquer interpretação, inclusive quando a chamada falha. Corrigir parsing nunca custa uma nova chamada: use `gemini.ParseRaw`.
5. As Observações nascem com `status = review`. Nenhuma aparece em série antes de o dono do documento, ou um `ADMIN`, confirmar o bloco.
6. `POST /api/extractions/{id}/confirm` promove tudo de uma vez e grava em `files` apenas os metadados ainda vazios. A guarda contra sobrescrever valor humano está no SQL (`COALESCE`/`NULLIF`), não no chamador.
7. Um documento guarda **uma** extração. Quando uma nova termina, as anteriores daquele documento são apagadas junto com o que elas tinham deixado em revisão. Observação já confirmada sobrevive: `extraction_id` é `ON DELETE SET NULL` e `source_file_id` continua dizendo de onde veio.
8. `DELETE /api/files/{id}/extractions` é o recomeço deliberado: apaga extrações **e** todas as Observações daquele documento, confirmadas inclusive. Serve para tentar outro modelo do zero. O documento, seus metadados e suas categorias ficam intactos.

Uma extração encontrada em `pending` no arranque é chamada perdida, não progresso: `ExtractionMarkStale` a marca como falha. Goroutine não sobrevive a reinício.

### Cliente Gemini

- `POST /v1beta/models/{model}:generateContent`, PDF inline em base64 (limite de 50MB; acima disso seria a Files API)
- `generationConfig.responseMimeType` e `responseSchema` em **camelCase** — em snake_case a API ignora em silêncio e devolve texto livre
- Esquema de saída declarado em Go, fonte única, com `prompt_version` e `schema_version` gravados em cada Extração
- Custo: `promptTokenCount` + (`candidatesTokenCount` + `thoughtsTokenCount`). Tokens de raciocínio são cobrados como saída
- O Gemini cobra 258 tokens por página de PDF; o texto nativo não é cobrado
- Modelo lido de `app_config.gemini_model`, padrão `gemini-3.1-flash-lite`, escolhido na aba admin a partir de lista curada em Go

### Catálogo e procedência

- `health_indicators` é global e semeado pela migração `007` com 55 Indicadores. Analito sem correspondência **nunca** cria Indicador: vira pendência, e promovê-lo é ação explícita de `ADMIN`
- `provenance = primary` é o bloco principal do laudo; `evolutive` é a tabela comparativa de coletas anteriores, que traz só valor e data. Na colisão, `primary` prevalece — é o que a chave única por procedência garante
- `value_text` guarda sempre o literal impresso; `value_num` só quando é número sem qualificador. `>90` jamais vira 90
- `ref_min`/`ref_max` só quando o laudo traz faixa única e inequívoca; `out_of_range` vem do marcador do próprio laboratório. O MedLog não calcula faixa nem decide se um resultado está alterado
- O valor é lido do literal impresso: `9.000(1)` vira `value_text` `"9.000(1)"` e `value_num` 9000, com `out_of_range` true tirado do marcador. O `(1)` é marcador do laboratório, não parte do número
- Número segue a convenção brasileira: **ponto agrupa milhar, vírgula abre decimal**. `3.650` é três mil seiscentos e cinquenta, e `5,40` é cinco e quatro décimos. Ler ao contrário desloca uma faixa de leucócitos por um fator de mil, que foi exatamente o defeito encontrado em uso real

### Privacidade

O PDF vai ao provedor **sem redação de PII** — nome completo, data de nascimento e número de ficha incluídos —, por decisão registrada no ADR 0005. O que protege é o consentimento por documento, gravado em `consented_at` com o autor em `triggered_by`, e a restrição a `ADMIN`: a chave é credencial do servidor e cada chamada custa dinheiro. Use tier pago; no Free Tier o conteúdo entra em treino.

> `internal/middleware/security.go` usa `X-Frame-Options: SAMEORIGIN`, com `frame-src 'self'`, `object-src 'self'` e `frame-ancestors 'self'` no CSP. A tela de revisão mostra o PDF ao lado dos valores, e `DENY` bloqueava até o enquadramento da própria origem. Enquadramento por terceiro continua bloqueado.

---

## Série Temporal de Indicadores

- `GET /api/health-series` e `/api/health-series/{code}` são rotas de **usuário**, não de admin: ler o próprio indicador é uso comum. O escopo é sempre o usuário da sessão — o compartilhamento familiar cobre profissionais e clínicas, nunca resultado de exame
- Só Observação `confirmed` existe para a série. O que está em Revisão não aparece nem no índice
- O gráfico é **Chart.js** (`chart.js/auto`, dependência npm empacotada pelo Vite, ADR 0012). CDN é impossível aqui: a CSP fixa `script-src 'self'` e o PWA promete offline
- Eixo X `linear` em milissegundos, com `ticks.callback` formatando em pt-BR — eixo `time` exigiria `chartjs-adapter-date-fns` mais `date-fns`, e `category` achataria coletas irregulares
- Tooltip traz Data de coleta, valor com unidade e Procedência; clique no ponto abre o Laudo de origem (`/api/files/{sourceFilename}`)
- Leitura da série prefere `primary` sobre `evolutive` na mesma Data de coleta (ADR 0013). A preferência é **só de leitura**: as duas linhas coexistem no banco, porque o índice único inclui `provenance`
- Faixa desenhada só quando `ref_min` **e** `ref_max` existem, usando a coleta mais recente que traz os dois. A fonte da banda está isolada em `pickReferenceBand()`, que é o único ponto a mudar quando a migração `009` semear as Faixas de normalidade
- Ponto `evolutive` é vazado, `primary` é sólido, `out_of_range` é vermelho
- Observação sem `value_num` aparece em lista, nunca no eixo

### Faixa de normalidade (ADR 0015)

Conceito distinto da Faixa de referência impressa no Laudo: vem de fonte citável e depende de Característica do usuário (sexo biológico e idade), enquanto a do Laudo é transcrição do papel.

- Tabela `indicator_normal_ranges` (migração `008`), semeada pela **`009`** com 78 faixas cobrindo os 55 Indicadores: 47 com banda de dois lados, 17 de um lado só, 14 sem número. Colunas `sex`, `age_min`/`age_max`, `min`/`max`, `text` e `source` **obrigatório**. Nulo em `sex` ou idade significa "qualquer"; nulo em `min`/`max` significa "sem banda para desenhar", e a faixa ainda existe como texto
- A `009` semeia **uma linha por (Indicador, sexo, faixa de idade)**. Duas linhas de igual especificidade servindo ao mesmo perfil dariam empate permanente, e o efeito seria a banda nunca ser desenhada — falha silenciosa. `internal/db/migrate009_test.go` varre sexo × idade de 18 a 100 para garantir que isso não acontece
- Divergência entre sociedades médicas fica **no texto da linha**, nunca em linha própria: vitamina D semeia a posição SBEM/SBPC-ML (20–60 ng/mL) e TSH semeia o manual Fleury por faixa etária, com os números divergentes citados no texto
- `models.NormalRangeResolve` casa as linhas contra o perfil e escolhe a **mais específica**. Característica desconhecida não filtra nada: com o sexo em branco, as linhas de homem e de mulher continuam candidatas, o empate sobrevive, a tela lista todas e **não** desenha banda
- Idade é a de **hoje**, em anos completos, e a banda é um retângulo. Série de criança exigiria polígono em degraus — teto anotado em comentário `ponytail:`
- Indicador sem faixa cadastrada responde vazio, e a tela diz "não cadastrada". A IA nunca preenche faixa clínica
- `GET /api/health-series/{code}` devolve `{observations, normalRange}` numa só resposta: a tela não desenha sem os dois, e um segundo pedido só somaria piscada
---

## Backup e Restauração

Disponível em Admin → aba **Backup & Restauração**:

- **Backup:** faz `PRAGMA wal_checkpoint(TRUNCATE)` e serve o arquivo `.sqlite` diretamente
- **Restauração:** valida magic bytes SQLite, substitui atomicamente via rename, re-pinga a conexão, invalida sessões ativas

---

## Testes

Testes de integração usando SQLite `:memory:` + goose migrations:

```bash
go test ./...
```

Cobertura:
- `internal/models/` — user, consultation, professional (crud + batch specialties + count); `health_test.go` (dedup por procedência na leitura, ADR 0013); `normalrange_test.go` (resolução por especificidade, empate não desenha banda)
- `internal/handlers/` — auth (rate limit), consultations (pagination), professionals (list format); `users_me_test.go` (perfil: guarda de senha só na troca real de e-mail, nascimento como TEXT)
- `internal/db/` — `TestMigrate007`: a migração sobe e desce, o catálogo tem 55 linhas, `provenance` inválida é rejeitada pelo CHECK; `TestMigrate009` (`migrate009_test.go`): 78 Faixas de normalidade semeadas, nenhuma órfã, nenhum empate de especificidade para sexo × idade de 18 a 100
- `internal/handlers/extractions_test.go` — extração ponta a ponta contra provedor falso em `httptest`: consentimento obrigatório, linha antes da chamada, resposta bruta persistida, analito fora do catálogo virando pendência
- `internal/handlers/review_test.go` — confirmação em bloco, metadado humano preservado, reextração que substitui em vez de duplicar, e `TestReview_UnmappedNeverSerializesAsNull`: o campo `unmapped` do JSON de revisão nunca serializa como `null` quando o modelo omite a chave (slice nil do Go vira `null`, e o frontend fazia `.forEach` sem guarda)
- `internal/handlers/series_test.go` — série só com `confirmed`, escopo por usuário, ordem por data de coleta

Helpers:
- `internal/db/testhelper.go` — `SetupTestDB(t)`: abre `:memory:`, roda migrations, registra cleanup
- `handlers_test` — `wrapWithSession()`, `signInAndGetCookie()` para testes de handler

> Os testes **não rodam no CI**. O workflow roda lint, typecheck e build do frontend, e depois publica a imagem. Rodar `go test ./...` antes de commitar é responsabilidade de quem edita.

---

## Docker

Build multi-stage:
1. `node:20-alpine` → compila o Svelte
2. `golang:1.25-alpine` → compila o binário Go com frontend embutido (`CGO_ENABLED=0`)
3. `alpine:3.21` → imagem final (~30MB) com apenas o binário

Sem dependência de banco externo — SQLite é embedded.

Healthcheck integrado: `GET /health` ou `/medlog healthcheck` (modo CLI).

---

## Contribuindo

PRs são bem-vindos. Mantenha o stack simples e a imagem Docker pequena.
