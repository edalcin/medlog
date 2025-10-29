# Documentação Técnica - MedLog

Esta documentação contém informações técnicas detalhadas sobre a arquitetura, desenvolvimento e estrutura do banco de dados do MedLog.

---

## 🏗️ Arquitetura e Tecnologias

### Stack Tecnológico

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript 5+
- shadcn/ui + Tailwind CSS
- NextAuth.js para autenticação

**Backend:**
- Node.js 20+
- Express.js
- TypeScript 5+
- Prisma ORM

**Database:**
- MariaDB 11+

**Processamento de Imagens e PDFs:**
- Sharp (otimização de imagens)
- pdfjs-dist (processamento de PDFs)
- canvas (renderização em Node.js)

**Deploy:**
- Docker (multi-stage build)
- GitHub Container Registry (ghcr.io)
- Unraid ready

### Arquitetura

```
┌─────────────────────────────────────────────────┐
│              Next.js 14 Frontend                │
│   (React + TypeScript + shadcn/ui)              │
├─────────────────────────────────────────────────┤
│              NextAuth.js (OAuth)                │
├─────────────────────────────────────────────────┤
│         Express.js API Routes                   │
│   (TypeScript + Prisma)                         │
├─────────────────────────────────────────────────┤
│              MariaDB 11+                        │
│   (Prisma ORM)                                  │
└─────────────────────────────────────────────────┘
         ↓                    ↓
    Uploads              Cloudflare
  (Filesystem)            Tunnel
```

---

## 📊 Estrutura do Banco de Dados

O sistema utiliza 5 tabelas principais:

```
users
├── id (PK)
├── email (unique)
├── name
├── google_id
├── is_admin
├── active
└── timestamps

health_professionals
├── id (PK)
├── name
├── specialty (pode ser NULL em criação rápida)
├── crm
├── phone
├── phone_secondary (novo)
├── address
├── city (novo)
├── state (novo)
├── active (controla pulldown)
└── timestamps

consultations
├── id (PK)
├── user_id (FK → users)
├── professional_id (FK → health_professionals)
├── consultation_date
├── specialty
├── notes (Markdown)
└── timestamps

consultation_files
├── id (PK)
├── consultation_id (FK → consultations)
├── professional_id (FK → health_professionals) ⭐ NOVO
├── file_name
├── file_path
├── file_type
├── file_size
└── timestamps

sessions
├── id (PK)
├── user_id (FK → users)
├── expires_at
└── data
```

**⭐ Mudança Importante:** Arquivos agora têm `professional_id` para permitir busca direta de todos os arquivos de um profissional sem JOINs complexos.

---

## 🚀 Desenvolvimento Local

### Pré-requisitos

- Node.js 20+
- npm ou yarn
- MariaDB 11+

### Setup

```bash
# Clone o repositório
git clone https://github.com/edalcin/medlog.git
cd medlog

# Instale dependências
npm install

# Configure variáveis de ambiente (.env.local)
DATABASE_URL="mysql://medlog_user:senha@localhost:3306/medlog"
NEXTAUTH_SECRET="gere_com_openssl_rand_base64_32"
NEXTAUTH_URL="http://localhost:3000"
FILES_PATH="./uploads"

# Execute migrations
npx prisma db push

# Crie usuário admin
ADMIN_PASSWORD='SenhaForte123!' npm run seed:admin

# Inicie desenvolvimento
npm run dev
```

### Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Next.js dev server (http://localhost:3000)

# Database
npx prisma generate      # Gera Prisma Client
npx prisma migrate dev   # Cria migration
npx prisma studio        # GUI do banco (http://localhost:5555)
npx prisma db seed       # Popula com dados de teste

# Build
npm run build           # Build de produção
npm start               # Inicia produção

# Testes
npm test                # Testes unitários
npm run test:watch      # Watch mode

# Linting
npm run lint            # ESLint
npm run type-check      # TypeScript check
```

### Migrações e Seed

Para aplicar o schema do banco em produção/desenvolvimento:

```bash
npm run prisma:migrate:deploy
```

Gerar nova migration após alterar o schema (`prisma/schema.prisma`):

```bash
npm run prisma:migrate:dev
```

Gerar somente o client Prisma:

```bash
npm run prisma:generate
```

Criar usuário admin inicial (não armazene ADMIN_PASSWORD no .env):

```bash
ADMIN_PASSWORD='SenhaForte123!' npm run seed:admin
```

Reset local (cuidado - destrói dados):

```bash
npx prisma migrate reset
```

---

## 🔧 Configuração Avançada

### Variáveis de Ambiente Completas

```env
# Database (Obrigatório)
DATABASE_URL=mysql://medlog_user:senha_segura@192.168.1.100:3306/medlog

# Security (Obrigatório - gere com openssl rand -base64 32)
NEXTAUTH_SECRET=string_aleatoria_min_32_caracteres
NEXTAUTH_URL=http://192.168.1.100:3000

# Files (Obrigatório)
FILES_PATH=/app/data/uploads    # Path dos uploads no container

# Opcional
NODE_ENV=production             # production ou development
MAX_FILE_SIZE=10485760          # 10MB em bytes (padrão)
ALLOWED_FILE_TYPES=pdf,png,jpg,jpeg  # Tipos permitidos
```

### Limites e Configurações

- **Tamanho máximo por arquivo:** 10MB (configurável via `MAX_FILE_SIZE`)
- **Tipos de arquivo aceitos:** PDF, PNG, JPG/JPEG
- **Quantidade de arquivos:** Ilimitada
- **Thumbnails:** Gerados automaticamente para imagens (200x200px) e sob demanda para PDFs
- **Sessões:** Expiram em 7 dias de inatividade
- **Registros de Login:** Armazenados indefinidamente com índices para performance

---

## 🎯 Novas Funcionalidades (v2.0+)

### 1. Sistema de Registro de Logins

**Painel Administrativo → Aba "Logins"**

Rastreia todos os logins de usuários e administradores:

- **Dados registrados:** Nome, email, role (Admin/Usuário), data e hora
- **Filtros:** Por email/nome de usuário e intervalo de datas
- **Ordenação:** Por nome, email ou data/hora do login
- **Acesso:** Apenas administradores podem visualizar

**API:**
```
GET /api/admin/login-logs
Parâmetros:
  - userEmail: string (filtro por email/nome)
  - startDate: ISO-8601 (data inicial)
  - endDate: ISO-8601 (data final)
  - limit: number (padrão: 1000)
  - offset: number (padrão: 0)
```

**Banco de Dados:**
```sql
CREATE TABLE login_logs (
  id UUID PRIMARY KEY,
  userId UUID NOT NULL,
  userName VARCHAR(255),
  userEmail VARCHAR(255),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (userId),
  INDEX (timestamp)
);
```

---

### 2. Gerenciamento Avançado de Arquivos

**Painel Administrativo → Aba "Arquivos"**

Interface melhorada com modal de detalhes:

#### Interface da Tabela
- Clicar em qualquer linha abre modal com detalhes completos
- Exibe thumbnail pequeno (8x8px) de cada arquivo
- Tabela compacta e responsiva sem scroll horizontal
- Columns: Arquivo | Categoria | Data | Usuário | Profissional

#### Modal de Detalhes
Ao clicar em um arquivo, exibe:

**Seção de Visualização:**
- Imagem em tamanho grande (clicável para abrir em nova aba)
- PDF mostra thumbnail gerado
- Permite abrir arquivo original no navegador

**Informações Completas:**
- Nome e nome original (se renomeado)
- Tamanho do arquivo
- Tipo MIME
- Categoria do arquivo
- Data da consulta associada
- Usuário que enviou
- Profissional associado
- Data/hora de upload
- Status de thumbnail

**Botões de Ação:**
- `Visualizar Arquivo` - Abre em nova aba do browser
- `Gerar Thumbnail` - Gera thumbnail sob demanda (PDFs e imagens)
- `Editar` - Abre formulário para renomear
- `Excluir` - Remove arquivo com confirmação
- `Fechar` - Fecha o modal

---

### 3. Geração de Thumbnails

#### Automática (no upload)
- **Imagens (PNG, JPG):** Thumbnail gerado automaticamente no upload
- **PDFs:** Thumbnail gerado sob demanda via botão no painel
- **Tamanho:** 200x200px
- **Qualidade:** PNG com compressão otimizada
- **Fallback seguro:** Upload não falha se geração de thumbnail falhar

#### Sob Demanda
**API:**
```
POST /api/files/generate-thumbnail/[fileId]
Resposta: { id, thumbnailPath }
Acesso: Apenas administradores
```

#### Técnica Implementada
- **Imagens:** Sharp (biblioteca otimizada de Node.js)
- **PDFs:** pdfjs-dist + canvas (sem dependência de Python)
- **Compatibilidade:** Windows, Linux, Docker, Unraid
- **Renderização PDF:** Primeira página em alta qualidade (DPI 150)

---

### 4. Detalhes Técnicos da Tabela de Arquivos

**Otimizações Implementadas:**

1. **Espaçamento Reduzido:**
   - Padding horizontal: px-3 (antes px-6)
   - Padding vertical: py-3 (antes py-4)
   - Economia de 50% de espaço horizontal

2. **Tratamento de Texto Longo:**
   - Nome de arquivo: `truncate` (ellipsis)
   - Email: `truncate` (não quebra linha)
   - Especialidades: `line-clamp-1` (máximo 1 linha)

3. **Elementos Compactos:**
   - Thumbnails: 8x8px (antes 10x10px)
   - Fonte geral: text-sm
   - Texto secundário: text-xs

4. **Resultado:**
   - ✅ Tabela cabe totalmente na tela
   - ✅ Todas as 5 colunas visíveis
   - ✅ Sem scroll horizontal

---

## 📚 Documentação Adicional

- **Especificação Técnica Completa:** `.specify/inicioDesenv.md`
- **Decisões Técnicas:** `.specify/decisions.md`
- **Roadmap de Desenvolvimento:** `.specify/READY_TO_START.md`
- **Guia de Início Rápido:** `START_HERE.md`
- **PRD Original:** `PRD.md`

---

## 🤝 Contribuindo

Este projeto é para uso pessoal/familiar, mas contribuições são bem-vindas:

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

**Última atualização: 29 de outubro de 2025**
