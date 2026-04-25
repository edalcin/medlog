# Relatório Comparativo de Stack — MedLog vs PKD

> **Nota:** Este documento serve como guia para futuras migrações evolutivas do MedLog.
> As seções de lições aprendidas descrevem problemas reais encontrados em uma tentativa
> de migração (2026-04-24) e suas soluções, para que possam ser aplicadas sem retrabalho.

## Visão Geral dos Projetos

| Característica | **MedLog** | **PKD** |
|---|---|---|
| Propósito | Rastreamento de consultas médicas | Base de conhecimento pessoal |
| Público | Famílias, uso doméstico | Uso pessoal |
| Deployment | Docker / Unraid | Docker / Unraid |
| Usuários | Multi-usuário com roles | Single-user (senha mestra) |
| Repositório | https://github.com/edalcin/medlog | https://github.com/edalcin/pkd |

---

## Tabela Comparativa de Stack

| Camada | **MedLog** | **PKD** |
|---|---|---|
| **Linguagem backend** | TypeScript (Node.js 20) | Go 1.25 |
| **Framework backend** | Next.js 14 (App Router) | Chi v5 (HTTP router) |
| **Frontend framework** | React 18 | Svelte 5 |
| **Build tool (frontend)** | Next.js (webpack/turbopack) | Vite 5 |
| **Banco de dados** | MariaDB 11+ (servidor externo) | SQLite (arquivo local) |
| **ORM / driver DB** | Prisma ORM + Prisma Engine | `modernc.org/sqlite` (driver puro Go) |
| **Autenticação** | NextAuth.js (JWT, credentials) | Senha mestra + tokens de sessão |
| **Estilização** | Tailwind CSS | CSS puro |
| **Editor de texto** | `<textarea>` com Markdown | TipTap 2 (rich text) |
| **Busca** | Query SQL simples | SQLite FTS5 (full-text search) |
| **Runtime do container** | `node:20-alpine` (~200 MB) | `distroless/static` (~2 MB) |
| **Imagem Docker final** | ~400–600 MB estimado | ~15–25 MB estimado |
| **Dependências externas** | MariaDB (container separado) | Nenhuma |
| **Licença** | GPL v3 | MIT |

---

## Análise: Tecnologias do PKD Adotáveis no MedLog

### 1. SQLite no lugar de MariaDB
**Viabilidade: Alta** | **Impacto: Alto**

| Aspecto | Detalhes |
|---|---|
| **Benefício** | Elimina dependência de um servidor MariaDB externo; todo o estado fica em um único arquivo |
| **Simplicidade** | `docker-compose.yml` deixa de precisar de um serviço `db` separado; backup vira cópia de arquivo |
| **Tamanho** | Remove ~300–400 MB da imagem MariaDB e a camada de rede entre containers |
| **Multi-usuário** | SQLite é totalmente compatível com múltiplos usuários. A limitação do SQLite é de **escrita concorrente em alta escala** (milhares de requisições simultâneas), não de múltiplos usuários cadastrados. Para o perfil do MedLog (uso doméstico, poucas dezenas de consultas por mês), SQLite com WAL mode é mais do que suficiente. O PKD, por exemplo, usa SQLite com múltiplos usuários sem problemas. |
| **Consideração** | Prisma já suporta SQLite nativamente; a migração envolve ajustes pontuais no schema (ver seção de lições aprendidas abaixo) |

### 2. Build Docker multi-stage com runtime mínimo (distroless)
**Viabilidade: Média** | **Impacto: Alto**

| Aspecto | Detalhes |
|---|---|
| **PKD adota** | Estágio 1 (Node build do frontend) → Estágio 2 (Go build) → Estágio 3 (distroless runtime, ~2 MB) |
| **MedLog hoje** | Node.js completo no runtime (`node:20-alpine`, ~170 MB), mais dependências npm |
| **Benefício** | Se o MedLog migrasse o backend para Go, o runtime poderia ser distroless; com Node.js, o mínimo é `node:20-alpine` |
| **Ganho parcial já possível** | Separar o build do frontend (Vite/SWC) do runtime Node.js no Dockerfile já reduz a imagem final em 30–50% |

### 3. SQLite FTS5 para busca
**Viabilidade: Alta** | **Impacto: Médio**

| Aspecto | Detalhes |
|---|---|
| **PKD adota** | Tabelas virtuais `fts5` dentro do próprio SQLite para busca em texto completo |
| **MedLog hoje** | Busca via `LIKE` / `CONTAINS` no MariaDB |
| **Benefício** | Busca nativa no arquivo SQLite, sem instalar Elasticsearch ou extensão extra; relevância por ranking |
| **Consideração** | Só faz sentido após adotar SQLite; Prisma não abstrai FTS5, exige `$queryRaw` |

### 4. Svelte 5 no lugar de React 18
**Viabilidade: Baixa** (reescrita total) | **Impacto: Médio**

| Aspecto | Detalhes |
|---|---|
| **Benefício** | Svelte compila para JS vanilla sem virtual DOM; bundle 30–50% menor; sem `react-dom` (~120 KB gzipped) |
| **Custo** | Reescrita completa do frontend; perda do ecossistema React (hooks, bibliotecas) |
| **Recomendação** | Não justifica para MedLog; o ganho de tamanho é pequeno relativo ao esforço |

### 5. Go no lugar de Node.js/Next.js
**Viabilidade: Baixa** (reescrita total) | **Impacto: Muito Alto**

| Aspecto | Detalhes |
|---|---|
| **Benefício** | Binário estático ~10 MB vs runtime Node.js ~170 MB; imagem final distroless de ~15 MB vs ~400 MB |
| **Benefício adicional** | Performance de CPU e memória muito superiores; startup instantâneo |
| **Custo** | Reescrita completa do backend; perda de Next.js App Router, Prisma, NextAuth.js |
| **Recomendação** | Não justifica para MedLog na versão atual; considerável apenas em reescrita futura |

### 6. CSS puro no lugar de Tailwind CSS
**Viabilidade: Média** | **Impacto: Baixo**

| Aspecto | Detalhes |
|---|---|
| **Benefício** | Elimina a dependência do Tailwind e do processo de purge de CSS; CSS final ligeiramente menor |
| **Custo** | Reescrita dos componentes estilizados; perda de produtividade no desenvolvimento |
| **Recomendação** | Não justifica; Tailwind com PurgeCSS já gera CSS mínimo em produção (~5–15 KB) |

---

## Priorização de Adoções Recomendadas

| Prioridade | Tecnologia PKD | Esforço | Ganho em Simplicidade | Ganho em Tamanho Docker |
|---|---|---|---|---|
| **1ª** | SQLite no lugar de MariaDB | Médio | Muito Alto (elimina serviço externo) | Alto (~400 MB a menos) |
| **2ª** | Docker multi-stage otimizado (frontend separado do runtime) | Baixo | Médio | Médio (~30–50% menor) |
| **3ª** | SQLite FTS5 para busca full-text | Baixo (após SQLite) | Médio | Nenhum adicional |
| **4ª** | Svelte no lugar de React | Muito Alto | Baixo | Baixo |
| **5ª** | Go no lugar de Node.js | Extremamente Alto | Alto | Muito Alto |

---

## Lições Aprendidas: Tentativa de Migração MariaDB → SQLite (2026-04-24)

Uma migração para SQLite foi iniciada e revertida. Os problemas encontrados e suas soluções estão documentados aqui para que uma futura tentativa seja direta e sem surpresas.

---

### Problema 1 — Enums não são suportados no Prisma + SQLite

**O que aconteceu:** O `prisma db push` falhou porque o `schema.prisma` usava `enum` nativos do Prisma, que são traduzidos para `ENUM` no MySQL mas não têm equivalente no SQLite.

**Enums afetados no MedLog:**
- `UserRole` (`ADMIN`, `USER`) → campo `role` no model `User`
- `Theme` (`LIGHT`, `DARK`, `SYSTEM`) → campo `theme` no model `User`
- `ConsultationType` (`CONSULTATION`, `EVENT`) → campo `type` no model `Consultation`

**Solução — mudanças no `prisma/schema.prisma`:**

```prisma
// ANTES (MariaDB)
model User {
  role  UserRole @default(USER)
  theme Theme    @default(SYSTEM)
}
model Consultation {
  type  ConsultationType @default(CONSULTATION)
}
enum UserRole { ADMIN USER }
enum Theme    { LIGHT DARK SYSTEM }
enum ConsultationType { CONSULTATION EVENT }

// DEPOIS (SQLite)
model User {
  role  String @default("USER")
  theme String @default("SYSTEM")
}
model Consultation {
  type  String @default("CONSULTATION")
}
// enums removidos completamente
```

O restante do código (rotas de API, componentes React) que comparava `role === 'ADMIN'` continuou funcionando sem alteração, pois os valores string são idênticos.

---

### Problema 2 — `@db.Text` não é suportado no SQLite

**O que aconteceu:** O SQLite não distingue tipos de texto como `TEXT` vs `VARCHAR`. A anotação `@db.Text` do Prisma é específica do MySQL e causa erro no `prisma generate` com provider SQLite.

**Campos afetados:**
- `Professional.notes`
- `Consultation.notes`

**Solução:** Remover a anotação. O campo continua `String?` — o SQLite armazena texto de comprimento ilimitado nativamente.

```prisma
// ANTES
notes  String? @db.Text

// DEPOIS
notes  String?
```

---

### Problema 3 — `createMany` com `skipDuplicates` não é suportado no SQLite

**O que aconteceu:** O Prisma tipifica `skipDuplicates` como `never` quando o provider é SQLite. O TypeScript rejeita a chamada em tempo de compilação.

**Arquivos afetados:**
- `app/api/users/settings/sharing/clinics/route.ts`
- `app/api/users/settings/sharing/professionals/route.ts`

**Solução:** Remover a opção `skipDuplicates`. Garantir unicidade via lógica prévia ou constraint no schema.

```typescript
// ANTES
await prisma.model.createMany({ data, skipDuplicates: true })

// DEPOIS
await prisma.model.createMany({ data })
```

---

### Problema 4 — `PRAGMA wal_checkpoint` falha com `$executeRaw`

**O que aconteceu:** O endpoint de backup executava `PRAGMA wal_checkpoint(TRUNCATE)` via `prisma.$executeRaw`, que lança exceção porque `PRAGMA` retorna linhas e o Prisma espera um resultado de escrita.

**Solução:** Usar `$queryRawUnsafe` em vez de `$executeRaw`:

```typescript
// ANTES (erro: "Expected a write query")
await prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE)`

// DEPOIS (correto)
await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)')
```

---

### Problema 5 — Restore do banco causava 502 Bad Gateway com `process.exit`

**O que aconteceu:** O endpoint de restore, após substituir o arquivo `.sqlite`, chamava `process.exit(0)` esperando que o container reiniciasse. Em produção isso causava 502 Bad Gateway e o container não reiniciava automaticamente.

**Causa raiz:** Cada rota de API instanciava `new PrismaClient()` individualmente, então desconectar uma instância não afetava as outras. O `process.exit` era a única forma encontrada de "reiniciar" todas as conexões.

**Solução correta em duas partes:**

**Parte A — Singleton do Prisma client** (`lib/prisma/client.ts`):
```typescript
// Todas as 29 rotas de API devem importar deste singleton,
// não instanciar new PrismaClient() localmente.
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Parte B — Restore sem `process.exit`** (`app/api/admin/restore/route.ts`):
```typescript
// Desconecta o singleton antes de substituir o arquivo.
// Todas as rotas usam o mesmo singleton, então a próxima query
// reconectará automaticamente ao novo arquivo.
await prisma.$disconnect()

await fs.promises.unlink(`${dbPath}-wal`).catch(() => {})
await fs.promises.unlink(`${dbPath}-shm`).catch(() => {})
await fs.promises.rename(tmpPath, dbPath)

// Sem process.exit — o servidor continua rodando normalmente.
return NextResponse.json({ ok: true, message: 'Restauração concluída. Atualize a página para continuar.' })
```

**Atenção:** Verificar que TODAS as rotas usam o singleton antes de implementar o restore. Na migração original, 29 arquivos precisaram ser atualizados.

---

### Problema 6 — JWT session crash após restore do banco

**O que aconteceu:** Após um restore que substituía o banco de dados, o JWT do usuário logado continuava válido, mas o usuário não existia mais no novo banco. O callback `session` do NextAuth tentava atribuir `session.user = null`, o que causava crash no middleware.

**Solução** (`lib/auth/config.ts` — callback `session`):

```typescript
async session({ session, token }) {
  if (session.user && token) {
    try {
      // JWT válido mas usuário pode não existir no banco atual (após restore).
      // Se não existir, retorna session.user sem id/role — as rotas de API
      // retornam 401 naturalmente, forçando novo login.
      const exists = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { id: true },
      })
      if (exists) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.name = token.name as string
      }
    } catch {
      // Em caso de erro de banco, popula normalmente (fail-safe)
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.name = token.name as string
    }
  }
  return session
}
```

---

### Problema 7 — `binaryTargets` do Prisma no Docker

**O que aconteceu:** Com provider MySQL, o `schema.prisma` usava `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`. Com SQLite, o target correto é simplesmente `"linux-musl"` (imagem Alpine).

**Solução:**
```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl"]   // para Alpine; remover openssl-3.0.x
}
```

---

### Checklist para Futura Migração MariaDB → SQLite

Seguir esta ordem para evitar os problemas acima:

- [ ] **schema.prisma**: mudar `provider` de `"mysql"` para `"sqlite"`
- [ ] **schema.prisma**: mudar `binaryTargets` para `["native", "linux-musl"]`
- [ ] **schema.prisma**: converter todos os `enum` para `String` com `@default("VALOR")`; remover os blocos `enum`
- [ ] **schema.prisma**: remover todas as anotações `@db.Text`
- [ ] **Código**: buscar `skipDuplicates` e remover de todos os `createMany`
- [ ] **Singleton Prisma**: garantir que `lib/prisma/client.ts` existe e todas as rotas o importam (não `new PrismaClient()` local)
- [ ] **Backup API**: usar `$queryRawUnsafe` para `PRAGMA wal_checkpoint(TRUNCATE)`
- [ ] **Restore API**: desconectar singleton, remover WAL/SHM, renomear arquivo; sem `process.exit`
- [ ] **Auth config**: proteger callback `session` com `try/catch` e verificar existência do usuário no banco atual
- [ ] **Dockerfile**: atualizar `DATABASE_URL` de build para `file:/tmp/medlog-build.sqlite`
- [ ] **docker-entrypoint.sh**: substituir `prisma migrate deploy` por `prisma db push --accept-data-loss`; criar diretório do SQLite antes
- [ ] **docker-compose.yml**: remover serviço `db` (MariaDB); atualizar `DATABASE_URL` para caminho do arquivo SQLite
- [ ] **Migração de dados**: usar script one-shot para copiar dados do MariaDB para o SQLite antes de remover o serviço antigo

---

## Conclusão

A adoção com melhor custo-benefício para o MedLog é a **migração para SQLite**, que eliminaria o servidor MariaDB externo — tornando o sistema verdadeiramente self-contained em um único container, simplificando o `docker-compose.yml`, reduzindo a imagem total e facilitando o backup (um único arquivo). O sistema ser **multi-usuário não é incompatível** com SQLite: a restrição do SQLite é de escrita concorrente em alta escala, não de múltiplos usuários cadastrados. Para o perfil de uso do MedLog, SQLite com WAL mode é mais do que adequado.

Combinada com um **Dockerfile multi-stage mais enxuto**, essa mudança reduziria a imagem Docker de ~500 MB para ~150–200 MB sem reescrever nenhuma lógica de negócio. As demais adoções (Go, Svelte) trariam ganhos maiores de desempenho e tamanho, mas exigiriam reescrita total do projeto — algo a considerar apenas em uma eventual versão 2.0.
