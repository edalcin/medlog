# MedLog - Sistema de Registro de Consultas Médicas

> Sistema completo para gerenciamento de histórico médico pessoal e familiar

[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://github.com/edalcin/medlog/pkgs/container/medlog)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📋 Visão Geral

O MedLog é um sistema web self-hosted para centralizar todo o histórico médico de consultas, exames, laudos, receitas e procedimentos em um único local seguro e organizado.

Projetado especialmente para uso familiar, o sistema permite registrar consultas médicas em texto livre (com suporte a Markdown), fazer upload de PDFs e imagens de exames e resultados, além de gerenciar profissionais de saúde com suas especialidades.

### Problema que Resolve

A falta de um local centralizado onde todo o histórico médico possa ser consultado de forma organizada, causando:
- Dificuldade em encontrar resultados de exames antigos
- Perda de receitas e laudos médicos
- Falta de histórico completo ao consultar novos médicos
- Informações espalhadas em papéis, emails e diferentes aplicativos

---

## ✨ Funcionalidades

### 🩺 Evento Central: Registro de Consulta Médica

**O registro da consulta médica é o evento central do sistema.** Todo o fluxo foi otimizado para tornar este processo rápido e intuitivo:

**Fluxo de Registro:**
1. **Data da Consulta:** Selecione a data usando o date picker
2. **Profissional de Saúde:** 
   - Selecione de um pulldown (mostra apenas profissionais ativos)
   - **Criação Rápida:** Se o profissional não está na lista, digite o nome diretamente
   - O sistema cria um registro básico automaticamente
   - Complete os dados do profissional depois (CRM, telefone, endereço)
3. **Notas em Texto Livre:** Registre livremente com suporte a **Markdown**
4. **Upload de Arquivos:** Anexe PDFs e imagens durante ou após o registro
5. **Associação Dupla:** Arquivos ficam vinculados à consulta E ao profissional

### 🏥 Registro de Consultas Médicas
- Registre consultas com data, profissional, especialidade
- Notas em texto livre com **suporte a Markdown** para formatação
- Vincule profissionais de saúde às consultas
- Especialidades com lista predefinida + opção customizada

### 📄 Upload e Gestão de Arquivos
- Anexe receitas, imagens de exames, resultados e laudos
- Suporte para **PDF, PNG e JPG** (até 10MB por arquivo)
- **Visualizador de PDF embutido** para consulta rápida
- Geração automática de thumbnails para imagens
- **Associação dupla:** Arquivos vinculados à consulta E ao profissional
- Download seguro de arquivos

### 🔍 Visualização Multi-Perspectiva de Arquivos

**O sistema oferece três formas de visualizar arquivos:**

1. **Por Consulta:** Ver todos os arquivos de uma consulta específica
   - Uso: Revisar documentos de uma visita ao médico
   
2. **Por Profissional:** Ver todos os arquivos de todas as consultas com aquele profissional
   - Uso: Histórico completo de exames com seu cardiologista, por exemplo
   
3. **Por Especialidade:** Ver todos os arquivos de consultas de uma especialidade
   - Uso: Agrupar todos os exames cardiológicos, ortopédicos, etc.

### 👨‍⚕️ Gestão de Profissionais de Saúde

**Cadastro Completo:**
- Nome, especialidade, CRM
- Telefone principal e secundário
- Endereço completo (rua, cidade, estado)
- Notas adicionais

**Criação Rápida durante Registro:**
- Digite apenas o nome no momento da consulta
- Sistema cria registro básico automaticamente
- Complete os dados posteriormente na tela de edição

**Status Ativo/Inativo:**
- Apenas profissionais **ativos** aparecem no pulldown de seleção
- Profissionais inativos permanecem no sistema (não são deletados)
- Útil para médicos que não atende mais, mudança de cidade, etc.
- Consultas antigas mantêm a referência ao profissional

### 📊 Relatórios e Análises

**Relatório de Consultas por Profissional:**
- Quantas consultas foram feitas com cada médico
- Total de arquivos anexados por profissional
- Data da última consulta

**Relatório de Consultas por Especialidade:**
- Distribuição de consultas por especialidade
- Identificar quais áreas você mais visita

**Relatório de Consultas por Período:**
- Visualize consultas por dia, mês ou ano
- Identifique períodos com mais atividade médica
- Agrupe por especialidade

**Histórico Completo do Paciente:**
- Resumo completo do histórico médico de um usuário
- Estatísticas: total de consultas, arquivos, especialidades visitadas
- Timeline de todo o histórico
- Distribuição por profissional e especialidade

### 🔍 Visualização e Busca
- Visualize consultas por data, especialidade ou profissional
- Filtros avançados para localizar rapidamente
- Timeline de consultas
- Dashboard com estatísticas

### 👥 Gestão de Usuários (Administrador)
- Cadastre usuários da família por email (Gmail)
- Primeiro usuário vira administrador automaticamente
- Controle de acesso e permissões
- Ative/desative usuários

### 🔐 Autenticação Segura
- Login via **Google OAuth 2.0**
- Sem necessidade de criar senhas
- Sessões seguras e gerenciadas

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

## 🚀 Instalação

### Pré-requisitos

- **Unraid 6.10+** ou Docker/Docker Compose
- **MariaDB 11+** instalado e rodando
- **Conta Google Cloud** com OAuth 2.0 configurado

### Configuração do Google OAuth

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google+ API**:
   - Menu → APIs & Services → Library
   - Busque "Google+ API" e ative
4. Crie credenciais OAuth 2.0:
   - APIs & Services → Credentials
   - Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
5. Configure as URLs autorizadas:
   - **Authorized JavaScript origins:**
     - `http://SEU_IP:3000`
     - `https://SEU_DOMINIO` (se usar Cloudflare)
   - **Authorized redirect URIs:**
     - `http://SEU_IP:3000/api/auth/callback/google`
     - `https://SEU_DOMINIO/api/auth/callback/google`
6. Copie o **Client ID** e **Client Secret**

---

## 🐳 Instalação no Unraid

### Método 1: Via Docker Compose (Recomendado)

1. **Prepare o banco de dados MariaDB:**

```bash
# No terminal do Unraid, crie o banco de dados
docker exec -it mariadb mysql -u root -p
```

```sql
CREATE DATABASE medlog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'medlog_user'@'%' IDENTIFIED BY 'SUA_SENHA_SEGURA';
GRANT ALL PRIVILEGES ON medlog.* TO 'medlog_user'@'%';
FLUSH PRIVILEGES;
EXIT;
```

2. **Crie a estrutura de diretórios:**

```bash
mkdir -p /mnt/user/appdata/medlog/uploads
chmod 755 /mnt/user/appdata/medlog/uploads
```

3. **Crie o arquivo docker-compose.yml:**

```yaml
version: '3.8'

services:
  medlog:
    image: ghcr.io/edalcin/medlog:latest
    container_name: medlog
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # Database
      DB_HOST: 192.168.1.100  # IP do seu MariaDB
      DB_PORT: 3306
      DB_NAME: medlog
      DB_USER: medlog_user
      DB_PASSWORD: SUA_SENHA_SEGURA
      
      # Application
      NODE_ENV: production
      PORT: 3000
      APP_URL: http://192.168.1.100:3000  # Seu IP/domínio
      
      # Files
      FILES_PATH: /app/data/uploads
      
      # Google OAuth (copie do Google Cloud Console)
      GOOGLE_CLIENT_ID: xxx.apps.googleusercontent.com
      GOOGLE_CLIENT_SECRET: xxx
      GOOGLE_CALLBACK_URL: http://192.168.1.100:3000/api/auth/callback/google
      
      # Security (gere strings aleatórias)
      SESSION_SECRET: generate_random_string_min_32_chars
      JWT_SECRET: generate_another_random_string_min_32_chars
      NEXTAUTH_SECRET: generate_nextauth_random_string_min_32_chars
      NEXTAUTH_URL: http://192.168.1.100:3000
      
      # Admin (seu email do Gmail)
      ADMIN_EMAIL: seu-email@gmail.com
    volumes:
      - /mnt/user/appdata/medlog/uploads:/app/data/uploads
    networks:
      - medlog-network
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s

networks:
  medlog-network:
    driver: bridge
```

4. **Gere strings aleatórias para os secrets:**

```bash
# No terminal do Unraid
openssl rand -base64 32  # Para SESSION_SECRET
openssl rand -base64 32  # Para JWT_SECRET
openssl rand -base64 32  # Para NEXTAUTH_SECRET
```

5. **Inicie o container:**

```bash
cd /mnt/user/appdata/medlog
docker-compose up -d
```

6. **Verifique os logs:**

```bash
docker logs -f medlog
```

### Método 2: Via Interface do Unraid

1. **Acesse o Unraid Dashboard**
2. Vá em **Docker → Add Container**
3. Configure os seguintes parâmetros:

**Configurações Básicas:**
- **Name:** `medlog`
- **Repository:** `ghcr.io/edalcin/medlog:latest`
- **Network Type:** `Bridge`
- **WebUI:** `http://[IP]:[PORT:3000]`

**Port Mappings:**
| Container Port | Host Port | Type |
|----------------|-----------|------|
| 3000           | 3000      | TCP  |

**Volume Mappings:**
| Container Path      | Host Path                        | Mode |
|---------------------|----------------------------------|------|
| /app/data/uploads   | /mnt/user/appdata/medlog/uploads | RW   |

**Environment Variables:**

| Variable | Value | Description |
|----------|-------|-------------|
| `DB_HOST` | `192.168.1.100` | IP do servidor MariaDB |
| `DB_PORT` | `3306` | Porta do MariaDB |
| `DB_NAME` | `medlog` | Nome do banco de dados |
| `DB_USER` | `medlog_user` | Usuário do banco |
| `DB_PASSWORD` | `sua_senha_segura` | Senha do banco |
| `FILES_PATH` | `/app/data/uploads` | Path dos uploads (não alterar) |
| `NODE_ENV` | `production` | Ambiente |
| `PORT` | `3000` | Porta da aplicação |
| `APP_URL` | `http://SEU_IP:3000` | URL completa |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Do Google Cloud |
| `GOOGLE_CLIENT_SECRET` | `xxx` | Do Google Cloud |
| `GOOGLE_CALLBACK_URL` | `http://SEU_IP:3000/api/auth/callback/google` | URL de callback |
| `SESSION_SECRET` | `gere_string_aleatoria` | Min 32 caracteres |
| `JWT_SECRET` | `gere_outra_string_aleatoria` | Min 32 caracteres |
| `NEXTAUTH_SECRET` | `gere_mais_uma_string` | Min 32 caracteres |
| `NEXTAUTH_URL` | `http://SEU_IP:3000` | URL da aplicação |
| `ADMIN_EMAIL` | `seu-email@gmail.com` | Email do admin |

4. Clique em **Apply** para criar e iniciar o container

---

## 🔒 Configuração HTTPS com Cloudflare Tunnel

Para acesso externo seguro via HTTPS:

1. **Instale Cloudflare Tunnel no Unraid:**
   - Community Applications → Cloudflare Tunnel
   - Configure seu domínio no Cloudflare

2. **Configure o tunnel para apontar para o MedLog:**
   - Service: `http://medlog:3000`
   - Hostname: `medlog.seu-dominio.com`

3. **Atualize as variáveis de ambiente:**
   - `APP_URL`: `https://medlog.seu-dominio.com`
   - `NEXTAUTH_URL`: `https://medlog.seu-dominio.com`
   - `GOOGLE_CALLBACK_URL`: `https://medlog.seu-dominio.com/api/auth/callback/google`

4. **Atualize o Google OAuth:**
   - Adicione a URL HTTPS nas URIs autorizadas

---

## 🎯 Primeiro Acesso

1. **Acesse o sistema:** `http://SEU_IP:3000` (ou sua URL configurada)

2. **Faça login com Google:**
   - Clique em "Entrar com Google"
   - Use o email definido em `ADMIN_EMAIL`
   - Você será criado como **administrador**

3. **Configure seu perfil:**
   - O sistema criará automaticamente seu usuário
   - Você terá acesso total ao sistema

4. **Cadastre usuários da família:**
   - Vá em **Admin → Usuários**
   - Clique em "Novo Usuário"
   - Insira o email Gmail do familiar
   - Ele poderá fazer login na próxima vez

5. **Comece a usar:**
   - Cadastre profissionais de saúde
   - Registre consultas
   - Faça upload de exames e laudos

---

## 📖 Uso do Sistema

### Fluxo Principal: Registrar Consulta

O registro de consulta é o coração do sistema. Siga este fluxo:

#### 1. Nova Consulta

1. Vá em **Consultas → Nova Consulta**
2. Preencha a **Data da Consulta** (date picker)

#### 2. Selecionar ou Criar Profissional

**Opção A - Profissional Existente:**
- Clique no campo "Profissional de Saúde"
- Digite para buscar ou role a lista
- Selecione o profissional desejado
- A especialidade é preenchida automaticamente

**Opção B - Criar Profissional Rapidamente:**
- Digite o nome do novo profissional no campo
- Exemplo: "Dra. Ana Costa"
- Sistema cria o registro automaticamente
- Continue o registro da consulta normalmente
- **Depois:** Vá em **Profissionais** para completar CRM, telefone, endereço

> 💡 **Dica:** Use a criação rápida quando estiver no consultório e quiser registrar rapidamente. Complete os dados do profissional depois com calma.

#### 3. Registrar Notas da Consulta

Use o campo de notas com **Markdown** para formatação:

```markdown
## Sintomas Apresentados
- Dor de cabeça intensa (escala 8/10)
- Fotofobia
- Náuseas

## Diagnóstico
Enxaqueca com aura

## Prescrição
- Naratriptano 2,5mg (tomar ao primeiro sinal)
- Paracetamol 750mg (se necessário)

## Orientações
- Evitar alimentos com tiramina
- Manter diário de crises
- Retorno em 30 dias
```

#### 4. Anexar Documentos (Opcional)

Durante o registro ou depois:
- Arraste e solte arquivos (PDFs, imagens)
- Ou clique em **"Anexar Arquivos"**
- Tipos aceitos: PDF, PNG, JPG (até 10MB cada)
- Adicione descrição se desejar (Ex: "Receita", "Exame de sangue")

#### 5. Salvar

- Clique em **"Salvar Consulta"**
- Sistema confirma e mostra a consulta cadastrada
- Arquivos ficam vinculados à consulta E ao profissional

---

### Completar Dados do Profissional

Se você criou um profissional rapidamente:

1. Vá em **Profissionais → Listar Profissionais**
2. Profissionais com dados incompletos têm um ícone de alerta ⚠️
3. Clique em **Editar** no profissional
4. Complete os campos:
   - **Especialidade** (obrigatório para relatórios)
   - CRM (opcional)
   - Telefone principal
   - Telefone secundário (opcional)
   - Endereço completo
   - Cidade e Estado
   - Notas (horários de atendimento, convênio, etc.)
5. Clique em **Salvar**

---

### Visualizar Arquivos

**Por Consulta:**
1. Vá em **Consultas**
2. Clique na consulta desejada
3. Role até a seção "Arquivos Anexados"
4. Clique no arquivo para visualizar (PDF abre no navegador) ou baixar

**Por Profissional:**
1. Vá em **Profissionais**
2. Clique no profissional desejado
3. Aba **"Documentos"** mostra TODOS os arquivos de TODAS as consultas
4. Útil para ver todo o histórico de exames com aquele médico

**Por Especialidade:**
1. Vá em **Relatórios → Documentos por Especialidade**
2. Selecione a especialidade (Ex: "Cardiologia")
3. Sistema lista todos os arquivos de todas as consultas daquela especialidade
4. Útil para agrupar exames do coração, por exemplo

---

### Gerar Relatórios

#### Relatório por Profissional

1. Vá em **Relatórios → Por Profissional**
2. Opcionalmente, selecione um profissional específico
3. Defina período (opcional)
4. Clique em **Gerar**
5. Visualize:
   - Quantas consultas com cada médico
   - Total de documentos anexados
   - Data da última consulta

#### Relatório por Especialidade

1. Vá em **Relatórios → Por Especialidade**
2. Sistema mostra distribuição de consultas
3. Identifique quais especialidades você mais visita

#### Relatório por Período

1. Vá em **Relatórios → Por Período**
2. Selecione agrupamento: Dia, Mês ou Ano
3. Defina intervalo de datas
4. Filtre por profissional ou especialidade (opcional)
5. Visualize timeline do seu histórico médico

#### Histórico Completo

1. Vá em **Relatórios → Histórico do Paciente**
2. Selecione o usuário (você ou familiar)
3. Sistema gera relatório completo:
   - Resumo estatístico
   - Timeline completa
   - Distribuição por especialidade
   - Distribuição por profissional
   - Opção de exportar PDF (futuro)

---

### Gerenciar Profissionais

#### Desativar Profissional

Quando um profissional não atende mais, muda de cidade, etc:

1. Vá em **Profissionais**
2. Clique no profissional
3. Clique em **"Desativar"**
4. Confirme

**Resultado:**
- Profissional não aparece mais no pulldown de novas consultas
- Consultas antigas permanecem intactas com a referência
- Você pode reativar a qualquer momento

#### Reativar Profissional

1. Vá em **Profissionais**
2. Marque filtro **"Mostrar Inativos"**
3. Clique no profissional inativo
4. Clique em **"Reativar"**
5. Profissional volta a aparecer no pulldown

---

### Cadastrar Profissional de Saúde (Método Completo)

Se preferir cadastrar com todos os dados de uma vez:

1. Vá em **Profissionais → Novo Profissional**
2. Preencha todos os campos:
   - Nome completo: "Dr. João Silva"
   - Especialidade: "Cardiologia" (ou digite nova)
   - CRM: "12345-SP"
   - Telefone: "(11) 99999-9999"
   - Telefone secundário: "(11) 98888-8888"
   - Endereço: "Rua Example, 123, Sala 45"
   - Cidade: "São Paulo"
   - Estado: "SP"
   - Notas: "Atende Segunda a Sexta, 8h-18h. Aceita Unimed."
3. Clique em **Salvar**

### Cadastrar Usuários da Família (Admin)

1. Vá em **Admin → Usuários**
2. Clique em "Novo Usuário"
3. Insira o email Gmail do familiar
4. Ele poderá fazer login na próxima vez
5. Cada familiar terá seu próprio histórico médico

---

## 🔧 Configuração Avançada

### Variáveis de Ambiente Completas

```env
# Database (Obrigatório)
DB_HOST=192.168.1.100           # IP do MariaDB
DB_PORT=3306                    # Porta do MariaDB
DB_NAME=medlog                  # Nome do banco
DB_USER=medlog_user             # Usuário
DB_PASSWORD=senha_segura        # Senha

# Application (Obrigatório)
NODE_ENV=production             # production ou development
PORT=3000                       # Porta do app
APP_URL=http://192.168.1.100:3000  # URL completa

# Files (Obrigatório)
FILES_PATH=/app/data/uploads    # Path dos uploads

# Google OAuth (Obrigatório)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://192.168.1.100:3000/api/auth/callback/google

# Security (Obrigatório - gere strings aleatórias)
SESSION_SECRET=min_32_caracteres_aleatorios
JWT_SECRET=min_32_caracteres_aleatorios
NEXTAUTH_SECRET=min_32_caracteres_aleatorios
NEXTAUTH_URL=http://192.168.1.100:3000

# Admin (Obrigatório)
ADMIN_EMAIL=seu-email@gmail.com  # Primeiro admin

# Opcional
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

## 🔄 Atualização

### Atualizar para Nova Versão

```bash
# Parar o container
docker stop medlog

# Baixar nova versão
docker pull ghcr.io/edalcin/medlog:latest

# Remover container antigo
docker rm medlog

# Recriar com mesmas configurações
docker-compose up -d
```

**Nota:** As migrations de banco são aplicadas automaticamente no startup.

### Versões Específicas

```bash
# Usar versão específica
docker pull ghcr.io/edalcin/medlog:v1.0.0

# Ou no docker-compose.yml
image: ghcr.io/edalcin/medlog:v1.0.0
```

---

## 💾 Backup

### Backup do Banco de Dados

```bash
# Backup completo
docker exec mariadb mysqldump -u root -p medlog > medlog_backup_$(date +%Y%m%d).sql

# Restaurar backup
docker exec -i mariadb mysql -u root -p medlog < medlog_backup_20250107.sql
```

### Backup dos Arquivos

```bash
# Backup da pasta de uploads
tar -czf medlog_uploads_$(date +%Y%m%d).tar.gz /mnt/user/appdata/medlog/uploads

# Restaurar
tar -xzf medlog_uploads_20250107.tar.gz -C /mnt/user/appdata/medlog/
```

### Backup Automático (Recomendado)

Configure no Unraid:
1. **CA Backup/Restore Appdata** plugin
2. Adicione `/mnt/user/appdata/medlog` à lista
3. Configure backup diário/semanal

---

## 🐛 Troubleshooting

### Container não inicia

```bash
# Verificar logs
docker logs medlog

# Verificar se todas as variáveis estão definidas
docker exec medlog env | grep -E "DB_|GOOGLE_|NEXTAUTH_"
```

### Erro de conexão com banco de dados

```bash
# Testar conexão com MariaDB
docker exec -it mariadb mysql -h DB_HOST -u DB_USER -p DB_NAME

# Verificar se banco existe
docker exec -it mariadb mysql -u root -p -e "SHOW DATABASES;"

# Verificar se usuário tem permissões
docker exec -it mariadb mysql -u root -p -e "SHOW GRANTS FOR 'medlog_user'@'%';"
```

### Erro no OAuth Google

1. **Verificar Client ID e Secret:**
   - Confirme que estão corretos no `.env`
   - Sem espaços extras ou caracteres invisíveis

2. **Verificar URLs no Google Cloud:**
   - Callback URL deve estar exatamente igual
   - `http://` vs `https://` importa!

3. **Verificar Google+ API:**
   - Deve estar ativada no projeto
   - APIs & Services → Library → Google+ API

4. **Logs detalhados:**
   ```bash
   docker logs -f medlog
   ```

### Arquivos não aparecem

```bash
# Verificar permissões da pasta
ls -la /mnt/user/appdata/medlog/uploads

# Corrigir permissões
chmod -R 755 /mnt/user/appdata/medlog/uploads
chown -R nobody:users /mnt/user/appdata/medlog/uploads
```

### Upload falha

1. **Verificar tamanho do arquivo:** Máximo 10MB
2. **Verificar tipo:** Apenas PDF, PNG, JPG
3. **Verificar espaço em disco:**
   ```bash
   df -h /mnt/user/appdata/medlog/uploads
   ```

### Health check falha

```bash
# Verificar se app está respondendo
curl http://localhost:3000/health

# Verificar se porta está escutando
netstat -tulpn | grep 3000
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

## 🛠️ Desenvolvimento Local

### Pré-requisitos

- Node.js 20+
- npm ou yarn
- MariaDB 11+
- Conta Google Cloud (OAuth)

### Setup

```bash
# Clone o repositório
git clone https://github.com/edalcin/medlog.git
cd medlog

# Instale dependências
npm install

# Configure variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas configurações

# Execute migrations
npx prisma migrate dev

# Seed (opcional)
npx prisma db seed

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

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 🙏 Agradecimentos

- [Next.js](https://nextjs.org/) - Framework React
- [Prisma](https://www.prisma.io/) - ORM
- [NextAuth.js](https://next-auth.js.org/) - Autenticação
- [shadcn/ui](https://ui.shadcn.com/) - Componentes UI
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework

---

## 📞 Suporte

Para questões e suporte:
- **Issues:** [GitHub Issues](https://github.com/edalcin/medlog/issues)
- **Documentação:** Veja arquivos na pasta `.specify/`

---

**Desenvolvido com ❤️ para uso familiar**

*Última atualização: 2025-01-07*