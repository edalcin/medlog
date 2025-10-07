# 🚀 MedLog - START HERE

> Sistema de Registro de Consultas Médicas e Exames para Uso Familiar

**Status:** ✅ PRONTO PARA DESENVOLVIMENTO  
**Data:** 2025-01-07  
**Prazo:** 4 semanas (até 03/02/2025)

---

## 📁 Documentação Completa

Toda a especificação do projeto está em `.specify/`:

| Arquivo | Descrição | Tamanho |
|---------|-----------|---------|
| **READY_TO_START.md** | 👉 **LEIA PRIMEIRO** - Resumo executivo completo | 13 KB |
| **inicioDesenv.md** | Especificação técnica detalhada | 30 KB |
| **decisions.md** | Todas as decisões técnicas confirmadas | 8 KB |
| **clarifications.md** | Perguntas e respostas originais | 10 KB |
| **SETUP_COMPLETE.md** | Registro do setup realizado | 5 KB |

---

## 🎯 Decisões Chave

### Stack Tecnológico
```
Frontend:  Next.js 14 + React + TypeScript + shadcn/ui + Tailwind
Backend:   Express.js + TypeScript + Prisma
Database:  MariaDB 11+
Auth:      NextAuth.js (Google OAuth)
Deploy:    Docker → ghcr.io/edalcin/medlog → Unraid
```

### Exceções às Recomendações ⚠️
1. **Desktop first** (não mobile first)
2. **Cloudflare Tunnel** para HTTPS
3. **Sem logs de auditoria** no MVP
4. **Testes unitários básicos** (não integração)

---

## 🏗️ Estrutura do Projeto

```
medlog/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/         # API endpoints
│   │   ├── (auth)/      # Login page
│   │   └── (dashboard)/ # Protected pages
│   ├── components/       # React components
│   ├── lib/             # Utilities
│   └── server/          # Backend logic
├── prisma/              # Database schema
├── tests/               # Unit tests
├── Dockerfile           # Container config
└── README.md           # Final documentation
```

---

## 📊 Modelo de Dados (5 Tabelas)

```
users → health_professionals
  ↓
consultations → consultation_files
  ↓
sessions
```

**Nota:** `audit_logs` NÃO será implementado no MVP.

---

## 🗓️ Roadmap (4 Semanas)

### Semana 1: Fundação
- Setup Next.js + TypeScript + Prisma
- Google OAuth funcionando
- Layout básico

### Semana 2: Features Core  
- CRUD Profissionais
- CRUD Consultas (com Markdown)
- Admin: Gestão de usuários

### Semana 3: Arquivos
- Upload (PDF, PNG, JPG)
- Visualizador PDF embutido
- Thumbnails automáticos

### Semana 4: Finalização
- Testes unitários
- Swagger docs
- Docker + CI/CD
- Deploy ghcr.io

---

## 🚀 Como Começar

### 1. Criar Projeto Next.js
```bash
cd H:\git\medlog
npx create-next-app@latest . --typescript --tailwind --app --use-npm
```

### 2. Instalar Dependências Core
```bash
npm install prisma @prisma/client next-auth sharp multer
npm install -D @types/multer
```

### 3. Setup Prisma
```bash
npx prisma init
# Editar prisma/schema.prisma com modelo de dados
npx prisma migrate dev --name init
```

### 4. Configurar NextAuth
```bash
# Criar src/app/api/auth/[...nextauth]/route.ts
# Configurar Google OAuth Provider
```

### 5. Adicionar shadcn/ui
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input form
```

---

## 🔐 Google OAuth Setup

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie projeto "MedLog"
3. Ative "Google+ API"
4. Credentials → OAuth 2.0 Client
5. Adicione callback: `http://localhost:3000/api/auth/callback/google`
6. Copie Client ID e Secret para `.env.local`

---

## 🐳 Docker (Semana 4)

```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
# ... build steps ...

FROM node:20-alpine
# ... production setup ...
```

```yaml
# docker-compose.yml para dev
services:
  mariadb:
    image: mariadb:11
    # ...
  app:
    build: .
    # ...
```

---

## 📦 Variáveis de Ambiente

Criar `.env.local`:
```env
# Database
DATABASE_URL="mysql://user:pass@localhost:3306/medlog"

# NextAuth
NEXTAUTH_SECRET="generate-random-string"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxx"

# Files
FILES_PATH="./uploads"

# Admin
ADMIN_EMAIL="seu-email@gmail.com"
```

---

## 📚 Referências Rápidas

- 📘 [Next.js Docs](https://nextjs.org/docs)
- 🔐 [NextAuth.js](https://next-auth.js.org/)
- 🗄️ [Prisma](https://www.prisma.io/docs)
- 🎨 [shadcn/ui](https://ui.shadcn.com/)
- 📝 [react-markdown](https://github.com/remarkjs/react-markdown)
- 📄 [PDF.js](https://mozilla.github.io/pdf.js/)

---

## ✅ Checklist Inicial

**Semana 1 - Dia 1:**
- [ ] Criar projeto Next.js
- [ ] Instalar dependências
- [ ] Configurar Prisma schema
- [ ] Setup Google OAuth
- [ ] Criar layout básico

**Semana 1 - Dia 2:**
- [ ] Implementar NextAuth
- [ ] Criar página de login
- [ ] Middleware de autenticação
- [ ] Página de dashboard vazia

**Semana 1 - Dia 3:**
- [ ] Header e sidebar
- [ ] Rotas protegidas
- [ ] Primeiro usuário vira admin

---

## 🆘 Troubleshooting

**Erro de conexão MariaDB:**
```bash
# Verificar se MariaDB está rodando
docker ps | grep mariadb
# Testar conexão
mysql -h localhost -u root -p medlog
```

**Erro no Prisma:**
```bash
# Regenerar client
npx prisma generate
# Reset database (cuidado!)
npx prisma migrate reset
```

**Erro no NextAuth:**
- Verificar NEXTAUTH_SECRET está definido
- Confirmar callbacks no Google Cloud Console
- Verificar NEXTAUTH_URL correto

---

## 📞 Suporte

- **PRD Original:** `PRD.md`
- **Especificação Completa:** `.specify/inicioDesenv.md`
- **Decisões Técnicas:** `.specify/decisions.md`
- **Roadmap Detalhado:** `.specify/READY_TO_START.md`

---

## 🎯 Meta

**MVP completo em 4 semanas com:**
✅ Autenticação Google  
✅ Gestão de consultas médicas  
✅ Upload e visualização de arquivos  
✅ Interface desktop-first  
✅ Docker pronto para Unraid  

---

**Bom desenvolvimento! 🚀**

*Criado em: 2025-01-07*
