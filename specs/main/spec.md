# Feature Spec: MedLog v2 — Implementação Completa do Code Review

**Date**: 2026-05-17  
**Source**: docs/CODE_REVIEW_v2.md  
**Scope**: Resolução de todos os 30 itens identificados no relatório de revisão de código

---

## Overview

Implementar todas as correções e melhorias identificadas no relatório de revisão de código da versão v2 do MedLog. Os itens seguem a Matriz de Prioridades do relatório e devem ser implementados em ordem de criticidade.

---

## Requirements

### 🔴 Crítico (antes do próximo release público)

**#1 - Corrigir N+1 queries (consultas e profissionais)**
- `consultationBase()` em `models/consultation.go`: substituir chamadas individuais por JOINs e batch loads
- `ProfessionalFindAll()` em `models/professional.go`: batch load de specialties com `IN` clause
- Reduzir 100 consultas + 2 arquivos de 401 queries para ~4 queries

**#2 - Rate limiting no endpoint de login**
- Implementar middleware chi customizado sem dependências externas
- Usar SQLite para armazenar contadores (tabela `rate_limit_attempts`)
- Bloquear após 5 tentativas em 1 minuto por IP
- IP detection: `CF-Connecting-IP` (Cloudflare Tunnel) → `X-Forwarded-For` (quando `TRUST_PROXY=true`) → `RemoteAddr`
- Env var `TRUST_PROXY=true` habilita headers de proxy; default `false` para segurança

**#3 - Content-Security-Policy header**
- Adicionar CSP em `internal/middleware/security.go`
- Policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'`
- Sem serviços externos no frontend — `connect-src 'self'` suficiente

**#4 - Alinhar paths Docker**
- `docker-entrypoint.sh`: já usa `/app/data/`
- `docker-compose.yml`: corrigir para `/app/data/`
- `.env.example`: corrigir para `/app/data/`
- Volume único: `./data:/app/data`

**#5 - SESSION_SECRET persistente no SCS**
- `internal/auth/session.go`: ler `SESSION_SECRET` do env e passar ao SCS como chave de criptografia
- Sessões persistem entre restarts

**#6 - Remover cmd/migrate-mariadb e cmd/sqlite-import**
- Remover diretórios `cmd/migrate-mariadb/` e `cmd/sqlite-import/` (se existir)
- Eliminar credenciais hardcoded do repositório

---

### 🟡 Alta Prioridade

**#7 - Padronizar respostas da API para `{ data: T }`**
- Todos os endpoints devem retornar `{ data: T }` (singular e lista)
- Atualizar handlers em Go
- Atualizar `api.ts` no frontend para esperar `{ data: T }` em todos os endpoints

**#8 - Paginação nos endpoints de lista**
- Parâmetros: `?page=1&limit=20`
- Endpoints: `/consultations`, `/professionals`, `/admin/consultations`, `/admin/professionals`, `/admin/files`
- Resposta inclui metadados: `{ data: [...], total, page, limit }`

**#9 - Transação em ConsultationUpdate e UserUpdate**
- Substituir múltiplos UPDATEs independentes por uma única transação
- Construir query dinâmica com todos os campos alterados

**#10 - Logging de erros nos models**
- Adicionar `log.Printf` nos pontos com erros silenciados (`_`)
- Logar erro real antes de retornar "db error" genérico ao cliente
- Adotar `log/slog` para logging estruturado

**#11 - Corrigir badge Reports.svelte**
- `'CONSULTA'` → `'CONSULTATION'` na comparação de tipo

**#12 - Endpoint de alteração de senha pelo usuário**
- `PUT /api/users/me/password`
- Validar senha atual antes de alterar
- Bcrypt na nova senha

**#13 - Remover stores.ts vazio**
- Deletar `frontend/src/lib/stores.ts` (contém apenas `export {}`)

**#14 - Tema claro/escuro**
- Usar campo `theme` existente (SYSTEM, LIGHT, DARK) na tabela `users`
- CSS custom properties para variáveis de cor
- Media query `prefers-color-scheme` para SYSTEM
- Endpoint `PATCH /api/users/me/theme`
- Toggle no frontend (Navigation component)
- UX: aplicar tema imediatamente (optimistic update) + salvar via PATCH em background; sem loading state

**#15 - Visualização de login logs no admin**
- Aba "Logs de Acesso" no painel admin
- Exibir tabela `login_logs` com paginação
- Colunas: usuário, IP, user-agent, data/hora, status

---

### 🟢 Média Prioridade

**#16 - Testes de integração**
- `models/*_test.go`: testes com SQLite `:memory:`
- `handlers/*_test.go`: usando `httptest` + SQLite in-memory
- Prioridade: consultation, professional, auth handlers

**#17 - CRUD de phones**
- Tabela `phones` já existe no schema
- Associar a profissionais e clínicas
- Acesso: usuário regular faz CRUD nos phones dos próprios profissionais/clínicas (scoped por user_id via professional/clinic); admin pode gerenciar qualquer um
- Backend: model + handler CRUD
- Frontend: campos de telefone em profissionais e clínicas

**#18 - user_professional_sharing**
- Modelo e handlers para compartilhamento de profissionais entre usuários
- Escopo: usuário B vê profissionais de A nas listagens (dicionário somente) — sem acesso a consultas/arquivos de A
- Acesso: somente leitura dos profissionais compartilhados (B não pode editar profissionais de A)
- Frontend: UI para gerenciar compartilhamentos

**#19 - user_clinic_sharing**
- Modelo e handlers para compartilhamento de clínicas entre usuários
- Escopo: usuário B vê clínicas de A nas listagens (dicionário somente) — sem acesso a dados médicos de A
- Acesso: somente leitura das clínicas compartilhadas (B não pode editar clínicas de A)
- Frontend: UI para gerenciar compartilhamentos

**#20 - Substituir MarkdownPreview por marked**
- `npm install marked`
- Substituir regex parser em `MarkdownPreview.svelte`
- Manter HTML escaping para XSS protection

**#21 - Inline create de profissional no ConsultationNew**
- Adicionar `InlineCreate` component para profissional no formulário de consulta

**#22 - Cache com TTL no dashboard**
- Backend: cache em memória com TTL 5 minutos
- Ou: agrupar 8 queries com UNION ALL

---

### 🔵 Baixa Prioridade

**#23 - Documentação OpenAPI/Swagger**
**#24 - Unificar arquivos de migração duplicados**
**#25 - Análise de bundle size frontend**
**#26 - Tratamento de timeout/offline no frontend**
**#27 - Campo de busca no ProfessionalList**
**#28 - Limpar formulário após criar consulta**
**#29 - Cache-Control headers nos uploads**
**#30 - InlineCreate com address para clinics**

---

## Clarifications

### Session 2026-05-17

- Q: Quando usuário B tem compartilhamento de A, o que B pode ver? → A: Profissionais + clínicas de A (dicionários apenas) — sem acesso a consultas/arquivos. Somente leitura.
- Q: Rate limiting — fonte do IP do cliente? → A: `CF-Connecting-IP` primeiro (Cloudflare Tunnel), fallback `X-Forwarded-For` (TRUST_PROXY=true), fallback `RemoteAddr`.
- Q: Phones (#17) — quem pode criar/editar? → A: Usuário regular faz CRUD nos próprios profissionais/clínicas; admin pode gerenciar qualquer um.
- Q: Tema — como aplicar ao clicar no toggle? → A: Optimistic (aplica imediatamente) + salva via PATCH em background; sem loading state.
- Q: CSP connect-src — frontend acessa serviços externos? → A: Não. `connect-src 'self'` suficiente.

---

## Acceptance Criteria

- Todos os 6 itens críticos implementados e testados
- Todos os 9 itens de alta prioridade implementados
- N+1 queries eliminadas (verificar com logs de query count)
- Rate limiting funcional (testar com 5+ tentativas de login)
- Sessões persistem após restart do container
- Tema claro/escuro funcional para todos os usuários
- Login logs visíveis no admin
- API padronizada em `{ data: T }`
