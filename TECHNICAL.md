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
- **Thumbnails:** Gerados automaticamente (200x200px)
- **Sessões:** Expiram em 7 dias de inatividade

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

**Última atualização: 11 de outubro de 2025**
