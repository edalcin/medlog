# MedLog v0.1.0-alpha

## 🚀 MVP Release - Sistema de Registro Médico Familiar

Esta é a primeira versão alpha do MedLog, um sistema completo para gerenciamento de histórico médico pessoal e familiar.

### ✨ Funcionalidades Implementadas

#### 🔐 Autenticação e Segurança
- **Google OAuth 2.0** - Login seguro via Gmail
- **Middleware de autenticação** - Proteção de rotas
- **Sessões seguras** - Gerenciamento de sessão com NextAuth.js

#### 🩺 Gestão de Consultas Médicas
- **Registro de consultas** - Data, profissional e notas em Markdown
- **Seleção de profissionais** - Pulldown com profissionais ativos
- **Criação rápida** - Cadastro de profissionais durante consulta
- **Histórico completo** - Listagem com filtros e paginação

#### 👨‍⚕️ Gestão de Profissionais de Saúde
- **CRUD completo** - Criar, editar, listar profissionais
- **Status ativo/inativo** - Controle de visibilidade
- **Dados completos** - Nome, especialidade, CRM, contato
- **Associação automática** - Vinculação com consultas e arquivos

#### 📄 Sistema de Arquivos
- **Upload seguro** - PDFs, PNG, JPG (até 10MB)
- **Download direto** - Acesso aos arquivos originais
- **Associação dupla** - Arquivos vinculados à consulta E profissional
- **Validação de tipos** - Controle rigoroso de formatos aceitos

#### 🖥️ Interface Web Moderna
- **Design responsivo** - Desktop e mobile
- **Tailwind CSS** - Framework moderno e consistente
- **Componentes shadcn/ui** - Interface profissional
- **Navegação intuitiva** - Menu organizado por funcionalidades

#### 🐳 Infraestrutura Docker
- **Container otimizado** - Multi-stage build
- **GitHub Container Registry** - Imagens oficiais em `ghcr.io/edalcin/medlog`
- **Docker Compose** - Setup completo com MariaDB
- **Multi-plataforma** - Suporte a AMD64 e ARM64

### 🏗️ Arquitetura Técnica

- **Frontend**: Next.js 14 (App Router) + TypeScript + React 18
- **Backend**: Next.js API Routes + Prisma ORM
- **Database**: MariaDB 11+ com schema relacional
- **Autenticação**: NextAuth.js com Google OAuth
- **Styling**: Tailwind CSS + shadcn/ui
- **Deploy**: Docker + GitHub Actions CI/CD

### 📦 Como Usar

#### Opção 1: Docker (Recomendado)
```bash
# Pull da imagem
docker pull ghcr.io/edalcin/medlog:v0.1.0-alpha

# Usar com docker-compose
docker-compose up -d
```

#### Opção 2: Desenvolvimento Local
```bash
git clone https://github.com/edalcin/medlog.git
cd medlog
npm install
cp .env.example .env.local
# Configure suas variáveis de ambiente
npm run dev
```

### 🔧 Configuração Necessária

1. **Google Cloud Console** - Configure OAuth 2.0
2. **MariaDB** - Banco de dados MySQL/MariaDB
3. **Variáveis de ambiente** - Configure `.env` com credenciais

### 🎯 Status do MVP

✅ **Funcionalidades Core Implementadas:**
- Autenticação Google OAuth
- CRUD de consultas médicas
- CRUD de profissionais de saúde
- Upload e download de arquivos
- Interface web responsiva
- API REST completa
- Container Docker
- Documentação completa

🔄 **Próximas Etapas (Fase 2):**
- Relatórios e dashboards
- Busca avançada e filtros
- Gestão de usuários familiares
- Timeline de histórico médico
- Exportação de dados

### 📊 Cobertura de Requisitos

- ✅ **US1**: Registrar consultas médicas - **IMPLEMENTADO**
- ✅ **US2**: Gerenciar profissionais de saúde - **IMPLEMENTADO**
- ✅ **US3**: Upload de arquivos médicos - **IMPLEMENTADO**
- 🔄 **US4**: Visualizar arquivos por perspectivas - **PARCIAL**
- ⏳ **US5**: Relatórios e estatísticas - **PENDENTE**
- ⏳ **US6**: Gestão de usuários familiares - **PENDENTE**

### 🐛 Limitações Conhecidas

- Interface administrativa limitada (apenas funcionalidades básicas)
- Sem relatórios avançados
- Sem busca full-text
- Sem notificações automáticas
- Sem backup automático

### 🤝 Contribuição

Esta versão alpha está pronta para testes e feedback. Para contribuir:

1. Teste a aplicação
2. Reporte bugs via [GitHub Issues](https://github.com/edalcin/medlog/issues)
3. Sugira melhorias e novas funcionalidades

### 📝 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

---

**Data de Lançamento:** 7 de outubro de 2025
**Status:** Alpha - Pronto para testes
**Compatibilidade:** Docker, Linux, macOS, Windows