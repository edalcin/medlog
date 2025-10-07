# Decisões Finais - MedLog

**Data:** 2025-01-07  
**Status:** ✅ Aprovado para início do desenvolvimento

---

## Decisões Técnicas Confirmadas

### 1. Stack Backend
**Decisão:** Express.js  
**Justificativa:** Simplicidade e rapidez no desenvolvimento para uso familiar.

### 2. Arquitetura
**Decisão:** Monolito (frontend + backend em um único container)  
**Justificativa:** Deploy simplificado no Unraid com apenas um container.

### 3. TypeScript
**Decisão:** Sim, TypeScript 5+ em todo o projeto  
**Justificativa:** Melhor manutenibilidade, type safety e menos erros.

### 4. Frontend Framework
**Decisão:** Next.js 14 com App Router  
**Justificativa:** Ecossistema maduro, SSR/SSG, integração com NextAuth.

### 5. ORM
**Decisão:** Prisma  
**Justificativa:** Type-safe, ótima DX, migrations automáticas.

### 6. Autenticação
**Decisão:** NextAuth.js  
**Justificativa:** Integração nativa com Next.js, simplicidade.

### 7. Gestão de Sessões
**Decisão:** Híbrido (JWT + sessions no banco)  
**Justificativa:** Performance com possibilidade de logout/revogação.

### 8. Evento Central
**Decisão:** Registro de Consulta Médica é o fluxo principal  
**Justificativa:** Sistema projetado para otimizar este processo como prioridade absoluta.

---

## Funcionalidades

### 9. Editor de Notas
**Decisão:** Editor com suporte a Markdown  
**Justificativa:** Permite formatação básica sem complexidade excessiva.

### 10. Visualização de PDFs
**Decisão:** Visualizador embutido (PDF.js) + opção de download  
**Justificativa:** Melhor UX, visualização sem sair do sistema.

### 11. Especialidades Médicas
**Decisão:** Híbrido (lista pré-definida + opção "Outro")  
**Lista:** Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Ginecologia/Obstetrícia, Neurologia, Oftalmologia, Ortopedia, Otorrinolaringologia, Pediatria, Psiquiatria, Urologia, Clínico Geral, Outro.

### 12. Criação de Profissionais
**Decisão:** Criação rápida durante registro de consulta  
**Fluxo:** Usuário digita nome → sistema cria registro básico → dados completos preenchidos depois  
**Justificativa:** Agiliza registro no momento da consulta, permite completar informações posteriormente.

### 13. Status de Profissionais
**Decisão:** Campo `active` (ativo/inativo)  
**Comportamento:** 
- Apenas ativos aparecem no pulldown de seleção
- Inativos permanecem no sistema (não são deletados)
- Consultas antigas mantêm referência
**Justificativa:** Permite gerenciar profissionais que não atendem mais sem perder histórico.

### 14. Associação Arquivo-Profissional
**Decisão:** Arquivos têm dupla associação (consultation_id + professional_id)  
**Schema:** Campo `professional_id` na tabela `consultation_files`  
**Justificativa:** Permite buscar arquivos por profissional sem JOINs complexos, melhora performance.

### 15. Visualização Multi-Perspectiva
**Decisão:** Três formas de visualizar arquivos  
**Perspectivas:**
1. Por Consulta (padrão)
2. Por Profissional (todos os arquivos de todas as consultas)
3. Por Especialidade (agrupar por área médica)
**Justificativa:** Flexibilidade na organização e busca de documentos médicos.

### 16. Relatórios
**Decisão:** Quatro tipos de relatórios principais  
**Tipos:**
1. Consultas por Profissional
2. Consultas por Especialidade
3. Consultas por Período (dia/mês/ano)
4. Histórico Completo do Paciente
**Justificativa:** Análise abrangente do histórico médico com diferentes perspectivas.

### 17. Dark Mode
**Decisão:** Não no MVP (melhoria futura)  
**Justificativa:** Focar em tema claro bem implementado primeiro.

### 12. Limites de Arquivo
**Decisão:** 
- Tamanho máximo: 10MB por arquivo
- Quantidade: Ilimitada (alerta se > 20)
- Storage: Alerta ao admin quando atingir 80%

### 13. Thumbnails
**Decisão:** Sim, gerar automaticamente para imagens  
**Justificativa:** Melhor performance e UX nas listagens.

### 14. Busca
**Decisão:** Busca simples no MVP (filtros por data, especialidade, profissional)  
**Melhoria futura:** Full-text search nas notas.

---

## Interface do Usuário

### 15. Responsividade
**Decisão:** Desktop first  
**Exceção identificada:** Usuário especificou Desktop first (diferente da recomendação mobile first).

### 16. Idioma
**Decisão:** Português (Brasil) apenas  
**Justificativa:** Uso familiar, simplifica MVP.

### 17. Notificações
**Decisão:** Não no MVP  
**Melhoria futura:** Lembretes de consultas, alertas para admin.

---

## Segurança e Privacidade

### 18. HTTPS
**Decisão:** HTTPS via Cloudflare Tunnel + HTTP local para testes  
**Exceção identificada:** Usuário especificou Cloudflare Tunnel (mais específico que a recomendação).

### 19. Backup
**Decisão:** Manual (instruções no README)  
**Melhoria futura:** Backup automático.

### 20. Logs de Auditoria
**Decisão:** Não implementar no MVP  
**Exceção identificada:** Usuário optou por não implementar (diferente da recomendação de logs críticos).  
**Impacto:** Simplifica MVP, mas remove rastreabilidade de ações.

### 21. Retenção de Dados
**Decisão:** Soft delete - usuário inativo mantém todos os dados  
**Justificativa:** Permite reativação sem perda de histórico médico.

---

## Deployment

### 22. Versionamento de Container
**Decisão:** Tags `latest` + versões específicas (`v1.0.0`, `v1.1.0`)  
**Justificativa:** Facilidade (latest) + estabilidade (versões).

### 23. Migrations de Banco
**Decisão:** Automático no startup (Prisma Migrate)  
**Justificativa:** Deploy simplificado, menos intervenção manual.

### 24. Health Check
**Decisão:** Verificar app + conexão com banco  
**Justificativa:** Garante que serviços essenciais estão funcionando.

---

## Dados e Testes

### 25. Seed Inicial
**Decisão:** Sim, com dados de exemplo  
**Conteúdo:** Profissionais fictícios, especialidades, consultas exemplo.

### 26. Paginação
**Decisão:**
- Consultas: 20 por página
- Profissionais: 50 por página
- Usuários: 50 por página
- Arquivos: Todos da consulta (sem paginação)

### 27. Cache
**Decisão:** Não no MVP (Redis como melhoria futura)  
**Justificativa:** Uso familiar não requer cache complexo.

### 28. Testes
**Decisão:** Testes unitários básicos  
**Exceção identificada:** Usuário optou por testes unitários (mais simples que a recomendação de testes de integração).  
**Impacto:** MVP mais rápido, mas com menos cobertura de testes.

---

## Documentação

### 29. Documentação de API
**Decisão:** Sim, usar Swagger/OpenAPI  
**Justificativa:** Facilita desenvolvimento e manutenção.

### 30. Comentários no Código
**Decisão:** Moderado (JSDoc em funções públicas, comentários em lógica complexa)  
**Justificativa:** Balanço entre documentação e produtividade.

---

## Exceções às Recomendações

As seguintes decisões diferem das recomendações originais:

1. **Responsividade:** Desktop first (ao invés de mobile first)
2. **HTTPS:** Cloudflare Tunnel especificado (mais detalhado)
3. **Logs de Auditoria:** Não implementar (ao invés de logs críticos)
4. **Testes:** Unitários básicos (ao invés de integração)

---

## Stack Tecnológico Final

```
Frontend:
- Next.js 14 (App Router)
- React 18
- TypeScript 5+
- shadcn/ui + Tailwind CSS
- NextAuth.js (Google OAuth)

Backend:
- Node.js 20+
- Express.js
- TypeScript 5+
- Prisma (ORM)

Database:
- MariaDB 11+

Deployment:
- Docker (multi-stage build)
- ghcr.io/edalcin/medlog
- Unraid
- Cloudflare Tunnel (HTTPS)

Tools:
- Multer (upload)
- PDF.js (visualização)
- Sharp (thumbnails)
- Swagger (documentação API)
```

---

## Estrutura do Projeto

```
medlog/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes
│   │   ├── (auth)/         # Auth pages
│   │   └── (dashboard)/    # Dashboard pages
│   ├── components/         # React components
│   ├── lib/               # Utilities e helpers
│   ├── server/            # Backend logic
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── services/
│   └── prisma/            # Prisma schema e migrations
├── public/                # Static assets
├── tests/                 # Unit tests
├── Dockerfile            # Multi-stage build
├── docker-compose.yml    # Dev environment
└── README.md            # Documentação
```

---

## Próximos Passos Imediatos

1. ✅ Inicializar estrutura do projeto
2. ✅ Configurar TypeScript e Next.js
3. ✅ Setup Prisma + MariaDB
4. ✅ Implementar autenticação Google OAuth
5. ✅ Criar UI básica com shadcn/ui
6. ✅ CRUD de profissionais
7. ✅ CRUD de consultas
8. ✅ Sistema de upload
9. ✅ Dockerfile e CI/CD
10. ✅ Deploy no ghcr.io

---

## Timeline

**Fase 1 - Fundação (Semana 1):**
- Setup do projeto
- Autenticação
- Layout básico

**Fase 2 - Features Core (Semana 2):**
- CRUD profissionais
- CRUD consultas
- Gestão usuários

**Fase 3 - Arquivos (Semana 3):**
- Upload/download
- Visualização PDF
- Thumbnails

**Fase 4 - Finalização (Semana 4):**
- Testes unitários
- Documentação
- Deploy

**Prazo:** 4 semanas a partir de 2025-01-07

---

**Aprovado por:** Usuário  
**Data de aprovação:** 2025-01-07  
**Status:** ✅ Pronto para desenvolvimento
