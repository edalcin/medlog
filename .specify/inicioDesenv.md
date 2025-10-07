# Especificação Técnica - MedLog
## Sistema de Registro de Consultas Médicas e Exames

---

## 1. Visão Geral do Sistema

### 1.1 Objetivo
O MedLog é um sistema de gerenciamento de registros médicos pessoais que permite centralizar todo o histórico médico de consultas, exames, procedimentos, receitas e laudos em um único local acessível e organizado.

### 1.2 Problema a Resolver
Falta de um local centralizado onde todo o histórico médico de consultas, exames e procedimentos possa ser consultado de forma organizada e segura.

### 1.3 Público-Alvo
Sistema para uso familiar restrito, com pequeno número de usuários (família) e um administrador.

---

## 2. Arquitetura Técnica

### 2.1 Stack Tecnológico Recomendado

**Backend:**
- **Framework:** Node.js com Express.js ou NestJS
  - Razão: Excelente performance, ecossistema maduro, fácil integração com OAuth 2.0
  - Alternativa: .NET Core (se preferir tipagem forte e performance ainda melhor)

**Frontend:**
- **Framework:** React com Next.js 14+ (App Router)
  - Razão: Interface moderna, SSR/SSG para melhor performance, excelente DX
  - UI Library: shadcn/ui + Tailwind CSS (design moderno e limpo)
  - Alternativa: Vue 3 + Nuxt 3

**Banco de Dados:**
- **Principal:** MariaDB (conforme especificado no PRD)
  - ORM: Prisma (Node.js) ou Entity Framework (.NET)

**Autenticação:**
- **OAuth 2.0:** Google OAuth
  - Biblioteca: Passport.js (Node.js) ou NextAuth.js (Next.js)

**Upload e Armazenamento:**
- **Files:** Sistema de arquivos local (path via variável de ambiente)
  - Biblioteca: Multer (Node.js) para upload
  - Suporte: PDF, PNG, JPG/JPEG

**Containerização:**
- **Docker:** Multi-stage build
- **Registry:** ghcr.io/edalcin/medlog

---

## 3. Estrutura de Dados

### 3.1 Modelo de Dados (Schema)

#### Tabela: `users`
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    profile_picture VARCHAR(500),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_email (email),
    INDEX idx_google_id (google_id)
);
```

#### Tabela: `health_professionals`
```sql
CREATE TABLE health_professionals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    specialty VARCHAR(255),  -- Pode ser NULL na criação rápida
    crm VARCHAR(20),
    phone VARCHAR(50),  -- Suporta múltiplos telefones separados
    phone_secondary VARCHAR(50),  -- Telefone adicional
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    active BOOLEAN DEFAULT TRUE,  -- Apenas ativos aparecem no pulldown
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_specialty (specialty),
    INDEX idx_name (name),
    INDEX idx_active (active)
);
```

**Nota sobre Profissionais:**
- Campo `specialty` pode ser NULL na criação rápida durante registro de consulta
- Campo `active` controla se o profissional aparece no pulldown de seleção
- Profissionais inativos permanecem no sistema mas não ficam disponíveis para novas consultas

#### Tabela: `consultations`
```sql
CREATE TABLE consultations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    professional_id INT,
    consultation_date DATE NOT NULL,
    specialty VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (professional_id) REFERENCES health_professionals(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_consultation_date (consultation_date),
    INDEX idx_user_date (user_id, consultation_date),
    INDEX idx_specialty (specialty),
    INDEX idx_professional (professional_id)
);
```

#### Tabela: `consultation_files`
```sql
CREATE TABLE consultation_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    consultation_id INT NOT NULL,
    professional_id INT,  -- Derivado da consulta, facilita queries
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type ENUM('pdf', 'image') NOT NULL,
    mime_type VARCHAR(100),
    file_size BIGINT,
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT,
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
    FOREIGN KEY (professional_id) REFERENCES health_professionals(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_consultation (consultation_id),
    INDEX idx_professional (professional_id),  -- Para buscar arquivos por profissional
    INDEX idx_file_type (file_type)
);
```

**Nota sobre Arquivos:**
- Arquivos são associados à **consulta** (consultation_id)
- Também são associados ao **profissional** (professional_id) para facilitar buscas
- O professional_id é copiado da consulta no momento do upload
- Permite visualizar todos arquivos de um profissional sem JOIN complexo

#### Tabela: `sessions`
```sql
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);
```

#### Tabela: `audit_logs`
```sql
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_action (user_id, action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
);
```

---

## 4. Evento Central do Sistema

### 4.1 Registro de Consulta Médica (Fluxo Principal)

**O registro da consulta médica é o evento central e mais importante do sistema.** Todo o sistema foi projetado em torno deste fluxo de uso principal.

#### 4.1.1 Fluxo de Registro Passo a Passo

**Passo 1: Início do Registro**
- Interface exibe formulário de nova consulta
- Campos iniciais obrigatórios:
  - **Data da Consulta** (date picker)
  - **Profissional de Saúde** (combobox/autocomplete)

**Passo 2: Seleção ou Criação de Profissional**

**Opção A - Profissional Existente:**
- Usuário seleciona profissional do pulldown/combobox
- Pulldown mostra **apenas profissionais ativos** (`active = true`)
- Lista ordenada alfabeticamente por nome
- Suporte a busca/filtro por nome
- Exibe: "Dr. João Silva - Cardiologia" (nome + especialidade)

**Opção B - Criação Rápida de Profissional:**
- Se profissional não está na lista:
  - Usuário digita o nome diretamente no campo (combobox permite texto livre)
  - Sistema detecta que é um nome novo
  - Cria registro de profissional automaticamente com:
    - `name`: o que foi digitado
    - `specialty`: NULL (será preenchido depois)
    - `active`: TRUE (padrão)
    - Outros campos vazios
  - Profissional fica disponível imediatamente para seleção
  - Posteriormente, dados completos são preenchidos na tela de edição

**Passo 3: Notas da Consulta (Texto Livre)**
- Campo de texto expansível (textarea ou editor Markdown)
- Suporte a **Markdown** para formatação
- Usuário registra livremente:
  - Sintomas apresentados
  - Diagnóstico do médico
  - Prescrições e medicamentos
  - Orientações recebidas
  - Procedimentos realizados
  - Observações pessoais
- Sem limite de caracteres
- Preview de Markdown em tempo real (opcional)

**Passo 4: Upload de Documentos e Imagens**
- Interface de upload durante o registro:
  - Drag & drop de múltiplos arquivos
  - Ou botão "Anexar Arquivos"
- Tipos aceitos: PDF, PNG, JPG/JPEG
- Limite: 10MB por arquivo
- Sem limite de quantidade de arquivos
- Preview dos arquivos selecionados antes de salvar
- Para cada arquivo, usuário pode adicionar:
  - Descrição/legenda (opcional)
  - Tipo de documento (receita, exame, laudo, etc.) - opcional

**Passo 5: Salvamento**
- Ao salvar consulta:
  1. Cria registro em `consultations`
  2. Para cada arquivo:
     - Salva no filesystem (`/uploads/user_id/consultation_id/`)
     - Cria registro em `consultation_files` com:
       - `consultation_id`: ID da consulta
       - `professional_id`: Copiado do profissional da consulta
       - Metadados do arquivo
  3. Retorna confirmação e redireciona para visualização da consulta

#### 4.1.2 Relacionamento Arquivo-Profissional

**Importante:** Arquivos têm dupla associação:
- **Primária:** `consultation_id` (arquivo pertence à consulta)
- **Secundária:** `professional_id` (copiado da consulta no momento do upload)

**Vantagens desta abordagem:**
1. Permite buscar todos arquivos de uma consulta: `WHERE consultation_id = X`
2. Permite buscar todos arquivos de um profissional: `WHERE professional_id = Y`
3. Permite buscar arquivos por especialidade: `JOIN professionals WHERE specialty = Z`
4. Não requer JOINs complexos para queries comuns
5. Se profissional mudar, arquivos mantêm referência original

#### 4.1.3 Interface de Registro (Mockup Textual)

```
┌─────────────────────────────────────────────────────┐
│ Nova Consulta                                  [X]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Data da Consulta: [__/__/____] 📅                  │
│                                                     │
│ Profissional: [Dr. João Silva - Cardiologia ▼]    │
│               └─ Digite para buscar ou adicionar   │
│                                                     │
│ Especialidade: [Cardiologia] (auto-preenchida)    │
│                                                     │
│ Notas da Consulta:                                 │
│ ┌───────────────────────────────────────────────┐ │
│ │ ## Sintomas                                    │ │
│ │ - Dor no peito ao esforço                     │ │
│ │                                               │ │
│ │ ## Diagnóstico                                │ │
│ │ Angina estável                                │ │
│ │                                               │ │
│ │ ## Prescrição                                 │ │
│ │ - AAS 100mg (1x/dia)                         │ │
│ │                                               │ │
│ └───────────────────────────────────────────────┘ │
│                                                     │
│ Arquivos Anexados:                                 │
│ ┌─────────────────────────────────────────────┐   │
│ │ 📄 receita_cardio.pdf (230 KB)              │   │
│ │ 📄 eletrocardiograma.pdf (1.2 MB)          │   │
│ │ 🖼️ exame_sangue.jpg (450 KB)               │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [+ Anexar mais arquivos] ou arraste aqui          │
│                                                     │
│              [Cancelar]  [Salvar Consulta]         │
└─────────────────────────────────────────────────────┘
```

#### 4.1.4 Validações no Registro

**Obrigatórios:**
- Data da consulta
- Profissional (nome mínimo 3 caracteres)

**Opcionais mas recomendados:**
- Notas da consulta
- Arquivos anexados
- Especialidade (auto-preenchida se profissional existente)

**Regras de negócio:**
- Data não pode ser futura (ou pode, para agendar?)
- Profissional criado rapidamente fica com `specialty = NULL`
- Arquivos são validados: tipo, tamanho
- Se criar profissional novo, sugerir completar dados após salvar

---

## 5. Funcionalidades Detalhadas

### 5.1 Autenticação e Autorização

#### 4.1.1 Login via Google OAuth 2.0
- **Fluxo:**
  1. Usuário clica em "Login com Google"
  2. Redirecionamento para Google OAuth
  3. Usuário autentica e autoriza
  4. Callback recebe token
  5. Sistema verifica se email está cadastrado
  6. Se primeiro acesso, cria administrador
  7. Se usuário cadastrado, cria sessão
  8. Atualiza last_login

- **Endpoints:**
  - `GET /auth/google` - Inicia OAuth flow
  - `GET /auth/google/callback` - Callback do Google
  - `GET /auth/user` - Retorna usuário logado
  - `POST /auth/logout` - Encerra sessão

#### 4.1.2 Controle de Acesso
- **Roles:**
  - **Admin:** Acesso total (gerenciar usuários, profissionais, consultas, arquivos)
  - **User:** Acesso aos próprios registros e criação de consultas/uploads

- **Middlewares:**
  - `isAuthenticated` - Verifica se usuário está logado
  - `isAdmin` - Verifica se usuário é administrador
  - `isOwnerOrAdmin` - Verifica se usuário é dono do recurso ou admin

### 4.2 Gestão de Usuários (Admin)

#### 4.2.1 Cadastro de Usuários
- **Endpoint:** `POST /api/admin/users`
- **Body:**
```json
{
  "email": "user@gmail.com",
  "name": "Nome do Usuário"
}
```
- **Validações:**
  - Email deve ser do Gmail
  - Email único
  - Apenas admin pode cadastrar

#### 4.2.2 Listagem de Usuários
- **Endpoint:** `GET /api/admin/users`
- **Query Params:**
  - `page` (default: 1)
  - `limit` (default: 20)
  - `search` (busca por nome ou email)
  - `active` (true/false)

#### 4.2.3 Edição de Usuários
- **Endpoint:** `PUT /api/admin/users/:id`
- **Body:**
```json
{
  "name": "Nome Atualizado",
  "active": true,
  "is_admin": false
}
```

#### 4.2.4 Desativação de Usuários
- **Endpoint:** `DELETE /api/admin/users/:id`
- **Comportamento:** Soft delete (active = false)

### 5.3 Gestão de Profissionais de Saúde

#### 5.3.1 Cadastro Completo de Profissional
- **Endpoint:** `POST /api/professionals`
- **Body:**
```json
{
  "name": "Dr. João Silva",
  "specialty": "Cardiologia",
  "crm": "12345-SP",
  "phone": "(11) 99999-9999",
  "phone_secondary": "(11) 98888-8888",
  "address": "Rua Example, 123, Sala 45",
  "city": "São Paulo",
  "state": "SP",
  "notes": "Atende Segunda a Sexta, 8h-18h",
  "active": true
}
```

#### 5.3.2 Criação Rápida de Profissional (durante registro de consulta)
- **Endpoint:** `POST /api/professionals/quick`
- **Body:**
```json
{
  "name": "Dra. Maria Santos"
}
```
- **Resposta:**
```json
{
  "id": 15,
  "name": "Dra. Maria Santos",
  "specialty": null,
  "active": true,
  "incomplete": true  // Flag indicando que dados estão incompletos
}
```

#### 5.3.3 Listagem de Profissionais Ativos (para pulldown)
- **Endpoint:** `GET /api/professionals/active`
- **Query Params:**
  - `search` (busca por nome)
- **Resposta:**
```json
[
  {
    "id": 1,
    "name": "Dr. João Silva",
    "specialty": "Cardiologia",
    "incomplete": false
  },
  {
    "id": 15,
    "name": "Dra. Maria Santos",
    "specialty": null,
    "incomplete": true  // Indicar visualmente que precisa completar dados
  }
]
```

#### 5.3.4 Listagem Completa de Profissionais
- **Endpoint:** `GET /api/professionals`
- **Query Params:**
  - `page`, `limit`
  - `search` (nome ou CRM)
  - `specialty` (filtro por especialidade)
  - `active` (true/false/all) - padrão: all
  - `incomplete` (true/false) - profissionais com dados incompletos

#### 5.3.5 Edição de Profissional
- **Endpoint:** `PUT /api/professionals/:id`
- **Body:** Mesmo schema do cadastro completo
- **Uso:** Completar dados de profissionais criados rapidamente

#### 5.3.6 Ativar/Desativar Profissional
- **Endpoint:** `PATCH /api/professionals/:id/status`
- **Body:**
```json
{
  "active": false
}
```
- **Comportamento:** 
  - Soft delete (profissional não é removido)
  - Profissionais inativos não aparecem no pulldown
  - Consultas antigas mantêm referência

#### 5.3.7 Listagem de Especialidades
- **Endpoint:** `GET /api/professionals/specialties`
- **Retorna:** Lista única de especialidades cadastradas (não NULL)

### 4.4 Gestão de Consultas

#### 4.4.1 Criação de Consulta
- **Endpoint:** `POST /api/consultations`
- **Body:**
```json
{
  "user_id": 1,
  "professional_id": 2,
  "consultation_date": "2025-01-07",
  "specialty": "Cardiologia",
  "notes": "Consulta de rotina. Pressão arterial normal..."
}
```

#### 4.4.2 Listagem de Consultas
- **Endpoint:** `GET /api/consultations`
- **Query Params:**
  - `user_id` (filtro por usuário)
  - `professional_id` (filtro por profissional)
  - `specialty` (filtro por especialidade)
  - `start_date`, `end_date` (filtro por período)
  - `page`, `limit`
  - `sort` (date_asc, date_desc)

#### 4.4.3 Visualização de Consulta
- **Endpoint:** `GET /api/consultations/:id`
- **Retorna:** Consulta completa com arquivos anexados

#### 4.4.4 Edição de Consulta
- **Endpoint:** `PUT /api/consultations/:id`

#### 4.4.5 Remoção de Consulta
- **Endpoint:** `DELETE /api/consultations/:id`
- **Comportamento:** Hard delete (cascade para arquivos)

### 4.5 Upload e Gestão de Arquivos

#### 4.5.1 Upload de Arquivo
- **Endpoint:** `POST /api/consultations/:id/files`
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` (arquivo)
  - `description` (opcional)

- **Validações:**
  - Tipos permitidos: PDF, PNG, JPG/JPEG
  - Tamanho máximo: 10MB por arquivo
  - Múltiplos uploads simultâneos

- **Processamento:**
  1. Validar tipo e tamanho
  2. Gerar nome único (UUID + extensão)
  3. Salvar em: `${FILES_PATH}/${user_id}/${consultation_id}/${filename}`
  4. Registrar no banco de dados
  5. Retornar metadata

#### 4.5.2 Listagem de Arquivos
- **Endpoint:** `GET /api/consultations/:id/files`

#### 4.5.3 Download de Arquivo
- **Endpoint:** `GET /api/files/:id/download`
- **Comportamento:** Stream do arquivo

#### 4.5.4 Visualização de Arquivo (Thumbnail)
- **Endpoint:** `GET /api/files/:id/thumbnail`
- **Comportamento:** 
  - Para imagens: redimensionar e retornar
  - Para PDF: retornar primeira página como imagem

#### 5.5.5 Remoção de Arquivo
- **Endpoint:** `DELETE /api/files/:id`
- **Comportamento:** Remove do filesystem e banco

### 5.6 Visualização de Arquivos (Múltiplas Perspectivas)

O sistema oferece três formas principais de visualizar arquivos:

#### 5.6.1 Arquivos por Consulta
- **Endpoint:** `GET /api/consultations/:consultation_id/files`
- **Descrição:** Ver todos os arquivos de uma consulta específica
- **Uso:** Visualização padrão ao abrir uma consulta
- **Query Params:**
  - `file_type` (pdf/image) - filtrar por tipo
- **Resposta:**
```json
{
  "consultation_id": 123,
  "consultation_date": "2025-01-07",
  "professional": "Dr. João Silva",
  "files": [
    {
      "id": 1,
      "file_name": "receita.pdf",
      "file_type": "pdf",
      "file_size": 245000,
      "uploaded_at": "2025-01-07T10:30:00Z"
    }
  ]
}
```

#### 5.6.2 Arquivos por Profissional
- **Endpoint:** `GET /api/professionals/:professional_id/files`
- **Descrição:** Ver **todos** os arquivos relacionados a um profissional (de todas as consultas)
- **Uso:** Histórico completo de documentos de um médico específico
- **Query Params:**
  - `file_type` (pdf/image)
  - `user_id` (filtrar por paciente)
  - `start_date`, `end_date` (filtrar por período)
  - `page`, `limit`
- **Resposta:**
```json
{
  "professional": {
    "id": 2,
    "name": "Dr. João Silva",
    "specialty": "Cardiologia"
  },
  "total_files": 45,
  "files": [
    {
      "id": 1,
      "file_name": "receita.pdf",
      "consultation_id": 123,
      "consultation_date": "2025-01-07",
      "user_name": "Maria Silva"
    },
    {
      "id": 15,
      "file_name": "exame_sangue.jpg",
      "consultation_id": 156,
      "consultation_date": "2024-12-15",
      "user_name": "João Santos"
    }
  ]
}
```

#### 5.6.3 Arquivos por Especialidade
- **Endpoint:** `GET /api/files/by-specialty`
- **Query Params:**
  - `specialty` (obrigatório) - "Cardiologia", "Ortopedia", etc.
  - `file_type` (pdf/image)
  - `user_id` (filtrar por paciente)
  - `start_date`, `end_date`
  - `page`, `limit`
- **Descrição:** Ver todos os arquivos de consultas de uma especialidade
- **Uso:** Agrupar todos exames cardiológicos, por exemplo
- **Resposta:**
```json
{
  "specialty": "Cardiologia",
  "total_files": 78,
  "files": [
    {
      "id": 1,
      "file_name": "eletro.pdf",
      "consultation_id": 123,
      "consultation_date": "2025-01-07",
      "professional_name": "Dr. João Silva",
      "user_name": "Maria Silva"
    }
  ]
}
```

### 5.7 Relatórios e Análises

O sistema oferece relatórios para análise do histórico médico:

#### 5.7.1 Relatório de Consultas por Profissional
- **Endpoint:** `GET /api/reports/consultations-by-professional`
- **Query Params:**
  - `professional_id` (opcional, se omitido mostra todos)
  - `user_id` (filtrar por paciente)
  - `start_date`, `end_date`
- **Resposta:**
```json
{
  "report_type": "consultations_by_professional",
  "period": {
    "start": "2024-01-01",
    "end": "2025-01-07"
  },
  "professionals": [
    {
      "id": 2,
      "name": "Dr. João Silva",
      "specialty": "Cardiologia",
      "total_consultations": 8,
      "last_consultation": "2025-01-07",
      "total_files": 23
    },
    {
      "id": 5,
      "name": "Dra. Ana Costa",
      "specialty": "Dermatologia",
      "total_consultations": 3,
      "last_consultation": "2024-11-20",
      "total_files": 8
    }
  ]
}
```

#### 5.7.2 Relatório de Consultas por Especialidade
- **Endpoint:** `GET /api/reports/consultations-by-specialty`
- **Query Params:**
  - `user_id` (filtrar por paciente)
  - `start_date`, `end_date`
- **Resposta:**
```json
{
  "report_type": "consultations_by_specialty",
  "specialties": [
    {
      "specialty": "Cardiologia",
      "total_consultations": 12,
      "professionals_count": 2,
      "last_consultation": "2025-01-07",
      "total_files": 35
    },
    {
      "specialty": "Dermatologia",
      "total_consultations": 5,
      "professionals_count": 1,
      "last_consultation": "2024-11-20",
      "total_files": 12
    }
  ]
}
```

#### 5.7.3 Relatório de Consultas por Período
- **Endpoint:** `GET /api/reports/consultations-by-period`
- **Query Params:**
  - `group_by` (day/month/year)
  - `user_id` (filtrar por paciente)
  - `start_date`, `end_date`
  - `professional_id` (opcional)
  - `specialty` (opcional)
- **Resposta (agrupado por mês):**
```json
{
  "report_type": "consultations_by_period",
  "group_by": "month",
  "periods": [
    {
      "period": "2025-01",
      "period_label": "Janeiro 2025",
      "total_consultations": 3,
      "specialties": {
        "Cardiologia": 2,
        "Ortopedia": 1
      },
      "total_files": 8
    },
    {
      "period": "2024-12",
      "period_label": "Dezembro 2024",
      "total_consultations": 2,
      "specialties": {
        "Dermatologia": 2
      },
      "total_files": 5
    }
  ]
}
```

#### 5.7.4 Histórico Completo do Paciente
- **Endpoint:** `GET /api/reports/patient-history/:user_id`
- **Query Params:**
  - `start_date`, `end_date`
  - `include_files` (true/false) - incluir lista de arquivos
- **Descrição:** Relatório completo do histórico médico de um usuário
- **Resposta:**
```json
{
  "patient": {
    "id": 1,
    "name": "Maria Silva",
    "email": "maria@gmail.com"
  },
  "summary": {
    "total_consultations": 25,
    "total_files": 67,
    "first_consultation": "2022-03-15",
    "last_consultation": "2025-01-07",
    "specialties_visited": 8,
    "professionals_visited": 12
  },
  "by_specialty": [
    {
      "specialty": "Cardiologia",
      "consultations": 12,
      "files": 35
    }
  ],
  "by_professional": [
    {
      "professional": "Dr. João Silva",
      "specialty": "Cardiologia",
      "consultations": 8,
      "files": 23
    }
  ],
  "timeline": [
    {
      "year": 2025,
      "consultations": 3
    },
    {
      "year": 2024,
      "consultations": 15
    }
  ]
}
```

### 5.8 Dashboard e Visualizações

#### 4.6.1 Dashboard Principal
- **Endpoint:** `GET /api/dashboard`
- **Retorna:**
```json
{
  "total_consultations": 25,
  "recent_consultations": [...],
  "consultations_by_specialty": {
    "Cardiologia": 5,
    "Ortopedia": 8
  },
  "files_count": 45,
  "professionals_count": 12
}
```

#### 4.6.2 Timeline de Consultas
- **Endpoint:** `GET /api/timeline`
- **Query Params:** `user_id`, `year`
- **Retorna:** Consultas agrupadas por mês/ano

---

## 5. Interface do Usuário (UI/UX)

### 5.1 Páginas e Componentes

#### 5.1.1 Página de Login
- Logo do sistema
- Botão "Entrar com Google" (proeminente)
- Design limpo e minimalista

#### 5.1.2 Dashboard
- **Header:**
  - Logo
  - Menu de navegação
  - Avatar do usuário (dropdown: perfil, sair)
  
- **Sidebar:** (opcional, pode ser menu top)
  - Dashboard
  - Consultas
  - Profissionais
  - Admin (se admin)

- **Content:**
  - Cards de estatísticas
  - Gráfico de consultas por especialidade
  - Últimas consultas (tabela)
  - Botão flutuante "Nova Consulta"

#### 5.1.3 Listagem de Consultas
- **Filtros:**
  - Busca por texto
  - Filtro por data (range picker)
  - Filtro por especialidade (dropdown)
  - Filtro por profissional (dropdown)

- **Visualização:**
  - Cards com informações resumidas
  - Data, profissional, especialidade
  - Preview de notas (truncadas)
  - Indicador de arquivos anexados
  - Ações: Ver, Editar, Excluir

#### 5.1.4 Detalhes da Consulta
- **Informações:**
  - Data, profissional, especialidade
  - Notas completas (markdown?)
  
- **Arquivos:**
  - Grid de thumbnails
  - Click para visualizar/baixar
  - Opção de adicionar mais arquivos
  
- **Ações:**
  - Editar consulta
  - Adicionar arquivo
  - Excluir consulta

#### 5.1.5 Formulário de Consulta
- **Campos:**
  - Data (date picker)
  - Usuário (select - admin only)
  - Profissional (select com busca)
  - Especialidade (select ou text com autocomplete)
  - Notas (textarea com editor rico opcional)
  
- **Upload:**
  - Drag & drop area
  - Preview de arquivos selecionados
  - Progress bar durante upload

#### 5.1.6 Gestão de Profissionais
- Listagem com busca e filtros
- Modal para adicionar/editar
- Cards com informações

#### 5.1.7 Admin - Gestão de Usuários
- Tabela de usuários
- Modal para adicionar usuário
- Toggle para ativar/desativar
- Badge para admin

### 5.2 Design System

**Cores:**
- Primary: Azul médico (#2563eb ou similar)
- Secondary: Cinza neutro
- Success: Verde
- Warning: Amarelo
- Error: Vermelho
- Background: Branco/Cinza claro
- Text: Cinza escuro

**Typography:**
- Font: Inter, System UI, ou similar
- Heading: Bold
- Body: Regular

**Componentes:**
- Buttons: Rounded, com states (hover, active, disabled)
- Cards: Shadow suave, rounded corners
- Forms: Labels claros, validation inline
- Modals: Overlay escuro, animação suave
- Toasts: Para feedback de ações

**Responsividade:**
- Mobile-first
- Breakpoints: 640px, 768px, 1024px, 1280px
- Menu adaptativo (hamburguer em mobile)

---

## 6. Variáveis de Ambiente

### 6.1 Docker Environment Variables

```env
# Database
DB_HOST=192.168.1.100
DB_PORT=3306
DB_NAME=medlog
DB_USER=medlog_user
DB_PASSWORD=secure_password

# Files Storage
FILES_PATH=/app/data/uploads

# Application
NODE_ENV=production
PORT=3000
APP_URL=https://medlog.example.com

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://medlog.example.com/auth/google/callback

# Session/JWT
SESSION_SECRET=your_very_long_random_secret_key
JWT_SECRET=another_very_long_random_secret

# Admin
ADMIN_EMAIL=admin@gmail.com
```

---

## 7. Estrutura do Projeto

### 7.1 Organização de Diretórios

```
medlog/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── oauth.js
│   │   │   └── multer.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── users.controller.js
│   │   │   ├── professionals.controller.js
│   │   │   ├── consultations.controller.js
│   │   │   └── files.controller.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── HealthProfessional.js
│   │   │   ├── Consultation.js
│   │   │   └── ConsultationFile.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── users.routes.js
│   │   │   ├── professionals.routes.js
│   │   │   ├── consultations.routes.js
│   │   │   └── files.routes.js
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   ├── validate.middleware.js
│   │   │   └── error.middleware.js
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── file.service.js
│   │   │   └── audit.service.js
│   │   ├── utils/
│   │   │   ├── logger.js
│   │   │   └── validators.js
│   │   ├── app.js
│   │   └── server.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── consultas/
│   │   │   │   ├── profissionais/
│   │   │   │   └── admin/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/ (shadcn components)
│   │   │   ├── layout/
│   │   │   ├── forms/
│   │   │   └── consultas/
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   └── styles/
│   ├── public/
│   ├── Dockerfile
│   ├── package.json
│   └── next.config.js
├── docker-compose.yml
├── Dockerfile (multi-stage)
├── .github/
│   └── workflows/
│       └── docker-publish.yml
├── README.md
└── PRD.md
```

---

## 8. Docker e Deployment

### 8.1 Dockerfile (Multi-stage)

```dockerfile
# Build stage - Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build stage - Backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./

# Production stage
FROM node:20-alpine
WORKDIR /app

# Install dependencies
RUN apk add --no-cache tini

# Copy backend
COPY --from=backend-builder /app/backend ./backend
COPY --from=frontend-builder /app/frontend/.next ./frontend/.next
COPY --from=frontend-builder /app/frontend/public ./frontend/public
COPY --from=frontend-builder /app/frontend/package*.json ./frontend/

# Install production dependencies
WORKDIR /app/frontend
RUN npm ci --production

WORKDIR /app/backend
RUN npm ci --production

# Create uploads directory
RUN mkdir -p /app/data/uploads

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use tini to handle signals
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "backend/src/server.js"]
```

### 8.2 Docker Compose (para desenvolvimento)

```yaml
version: '3.8'

services:
  mariadb:
    image: mariadb:11
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: medlog
      MYSQL_USER: medlog_user
      MYSQL_PASSWORD: medlog_pass
    ports:
      - "3306:3306"
    volumes:
      - mariadb_data:/var/lib/mysql
    networks:
      - medlog-network

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: mariadb
      DB_PORT: 3306
      DB_NAME: medlog
      DB_USER: medlog_user
      DB_PASSWORD: medlog_pass
      FILES_PATH: /app/data/uploads
      NODE_ENV: development
    volumes:
      - ./uploads:/app/data/uploads
    depends_on:
      - mariadb
    networks:
      - medlog-network

volumes:
  mariadb_data:

networks:
  medlog-network:
```

### 8.3 GitHub Actions (CI/CD)

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/edalcin/medlog
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

### 8.4 Instalação no Unraid

**README.md - Seção de Instalação:**

```markdown
## Instalação no Unraid

### Pré-requisitos
- Unraid 6.10 ou superior
- MariaDB instalado e configurado
- Conta Google Cloud com OAuth 2.0 configurado

### Configuração do Google OAuth

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Ative a Google+ API
4. Vá em "Credenciais" → "Criar Credenciais" → "ID do cliente OAuth"
5. Configure as URLs de redirecionamento:
   - `http://SEU_IP:3000/auth/google/callback`
   - `https://SEU_DOMINIO/auth/google/callback`
6. Copie o Client ID e Client Secret

### Instalação via Docker no Unraid

1. Acesse o Unraid Dashboard
2. Vá em "Docker" → "Add Container"
3. Configure os seguintes parâmetros:

**Configurações Básicas:**
- **Name:** medlog
- **Repository:** ghcr.io/edalcin/medlog:latest
- **Network Type:** Bridge

**Port Mappings:**
- **Container Port:** 3000
- **Host Port:** 3000 (ou sua preferência)
- **Connection Type:** TCP

**Volume Mappings:**
- **Container Path:** /app/data/uploads
- **Host Path:** /mnt/user/appdata/medlog/uploads
- **Access Mode:** Read/Write

**Environment Variables:**

| Variable | Value | Description |
|----------|-------|-------------|
| DB_HOST | IP_DO_SEU_MARIADB | IP do servidor MariaDB |
| DB_PORT | 3306 | Porta do MariaDB |
| DB_NAME | medlog | Nome do banco de dados |
| DB_USER | medlog_user | Usuário do banco |
| DB_PASSWORD | sua_senha_segura | Senha do banco |
| FILES_PATH | /app/data/uploads | Path dos uploads (não alterar) |
| NODE_ENV | production | Ambiente de execução |
| PORT | 3000 | Porta da aplicação |
| APP_URL | http://SEU_IP:3000 | URL completa da aplicação |
| GOOGLE_CLIENT_ID | seu_client_id | Client ID do Google OAuth |
| GOOGLE_CLIENT_SECRET | seu_client_secret | Client Secret do Google OAuth |
| GOOGLE_CALLBACK_URL | http://SEU_IP:3000/auth/google/callback | URL de callback |
| SESSION_SECRET | gere_uma_senha_longa_aleatoria | Secret para sessions |
| JWT_SECRET | gere_outra_senha_longa_aleatoria | Secret para JWT |
| ADMIN_EMAIL | seu_email@gmail.com | Email do primeiro admin |

4. Clique em "Apply" para criar e iniciar o container

### Configuração do Banco de Dados

O sistema criará automaticamente as tabelas necessárias no primeiro start. Certifique-se de que:

1. O banco de dados "medlog" existe no MariaDB
2. O usuário tem permissões completas no banco
3. O MariaDB está acessível do container

### Primeiro Acesso

1. Acesse: `http://SEU_IP:3000`
2. Clique em "Entrar com Google"
3. Faça login com o email definido em ADMIN_EMAIL
4. Você será criado como administrador
5. Cadastre outros usuários da família em Admin → Usuários

### Troubleshooting

**Erro de conexão com banco de dados:**
- Verifique se o IP e porta do MariaDB estão corretos
- Teste a conexão: `telnet IP_MARIADB 3306`
- Verifique logs: `docker logs medlog`

**Erro no OAuth Google:**
- Verifique se Client ID e Secret estão corretos
- Confirme que GOOGLE_CALLBACK_URL está nas URLs autorizadas no Google Cloud
- Verifique se a Google+ API está ativada

**Arquivos não aparecem:**
- Verifique permissões na pasta de uploads
- Confirme que o volume mapping está correto

### Backup

Recomenda-se fazer backup regular de:
1. Banco de dados MariaDB: `mysqldump -u root -p medlog > medlog_backup.sql`
2. Pasta de uploads: `/mnt/user/appdata/medlog/uploads`

### Atualização

Para atualizar para uma nova versão:
1. Pare o container: `docker stop medlog`
2. Remova o container: `docker rm medlog`
3. Puxe a nova imagem: `docker pull ghcr.io/edalcin/medlog:latest`
4. Recrie o container com as mesmas configurações
```

---

## 9. Segurança

### 9.1 Autenticação e Sessões
- OAuth 2.0 com Google (industry standard)
- Sessions com timeout configurável (default: 7 dias)
- JWT para API calls
- Refresh tokens para renovação automática

### 9.2 Autorização
- RBAC (Role-Based Access Control)
- Middleware de verificação em todas as rotas protegidas
- Validação de ownership nos recursos

### 9.3 Proteção de Arquivos
- Arquivos não servidos diretamente (não em public/)
- Download apenas via endpoint autenticado
- Validação de tipo MIME no upload e download
- Limite de tamanho por arquivo e total

### 9.4 Validação de Dados
- Sanitização de inputs
- Validação de tipos e formatos
- Proteção contra SQL Injection (via ORM)
- Proteção contra XSS
- CORS configurado apropriadamente

### 9.5 Auditoria
- Log de todas as ações críticas
- Registro de IPs
- Timestamps em todas as operações

### 9.6 Boas Práticas
- Environment variables para secrets
- Passwords hasheados (se houver)
- HTTPS em produção (configurar reverse proxy)
- Rate limiting em endpoints sensíveis
- Health check endpoint sem autenticação

---

## 10. Performance

### 10.1 Otimizações de Banco de Dados
- Índices nas colunas de busca frequente
- Query pagination
- Eager loading quando necessário
- Connection pooling

### 10.2 Otimizações de Frontend
- Code splitting
- Lazy loading de componentes
- Image optimization
- Caching de assets
- SSR/SSG quando apropriado

### 10.3 Otimizações de Backend
- Streaming de arquivos grandes
- Caching de queries repetitivas
- Compression (gzip)
- Keep-alive connections

### 10.4 Monitoramento
- Health check endpoint: `GET /health`
- Metrics endpoint (opcional): `GET /metrics`
- Logging estruturado

---

## 11. Testes

### 11.1 Testes Unitários
- Controllers
- Services
- Utilities
- Validators

### 11.2 Testes de Integração
- API endpoints
- Autenticação
- Upload de arquivos
- Database operations

### 11.3 Testes E2E
- Fluxos principais de usuário
- Login e logout
- CRUD de consultas
- Upload e download de arquivos

### 11.4 Ferramentas
- **Backend:** Jest, Supertest
- **Frontend:** Jest, React Testing Library, Playwright

---

## 12. Roadmap de Desenvolvimento

### 12.1 Fase 1 - MVP (2-3 semanas)
- [ ] Setup do projeto e estrutura
- [ ] Configuração do banco de dados
- [ ] Implementação do OAuth Google
- [ ] CRUD de profissionais
- [ ] CRUD de consultas (sem arquivos)
- [ ] Interface básica (login, dashboard, listagens)
- [ ] Docker e deploy inicial

### 12.2 Fase 2 - Core Features (2 semanas)
- [ ] Upload de arquivos
- [ ] Visualização de arquivos
- [ ] Gestão de usuários (admin)
- [ ] Filtros e busca
- [ ] Auditoria básica

### 12.3 Fase 3 - Refinamento (1-2 semanas)
- [ ] UI/UX polish
- [ ] Responsividade completa
- [ ] Otimizações de performance
- [ ] Testes
- [ ] Documentação completa

### 12.4 Fase 4 - Melhorias Futuras (opcional)
- [ ] Editor de notas com Markdown
- [ ] Exportação de relatórios (PDF)
- [ ] Busca full-text
- [ ] Notificações
- [ ] PWA (instalável)
- [ ] Dark mode
- [ ] Múltiplos idiomas

---

## 13. Dependências Principais

### 13.1 Backend (Node.js)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "express-session": "^1.17.3",
    "prisma": "^5.8.0",
    "@prisma/client": "^5.8.0",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.3.1",
    "joi": "^17.11.0",
    "uuid": "^9.0.1",
    "compression": "^1.7.4",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

### 13.2 Frontend (Next.js)

```json
{
  "dependencies": {
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "next-auth": "^4.24.5",
    "@tanstack/react-query": "^5.17.9",
    "axios": "^1.6.5",
    "date-fns": "^3.0.6",
    "react-hook-form": "^7.49.3",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.4",
    "tailwindcss": "^3.4.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.303.0"
  }
}
```

---

## 14. Considerações Finais

### 14.1 Escalabilidade
O sistema foi projetado para uso familiar (baixo volume), mas a arquitetura permite escalabilidade:
- Adicionar Redis para cache/sessions
- Mover uploads para S3/MinIO
- Load balancer com múltiplas instâncias
- Read replicas no banco

### 14.2 Manutenibilidade
- Código limpo e bem estruturado
- Separação de responsabilidades
- Documentação inline
- README detalhado

### 14.3 Extensibilidade
- API RESTful documentada
- Arquitetura modular
- Fácil adicionar novos recursos
- Webhooks futuros

### 14.4 Acessibilidade
- Semantic HTML
- ARIA labels
- Contraste adequado
- Navegação por teclado

---

## 15. Anexos

### 15.1 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia dev server
npm run build           # Build para produção
npm run start           # Inicia produção
npm run test            # Executa testes

# Docker
docker build -t medlog .                    # Build da imagem
docker run -p 3000:3000 --env-file .env medlog  # Executa container
docker-compose up                           # Inicia stack completa

# Database
npx prisma migrate dev    # Cria migration
npx prisma generate       # Gera Prisma Client
npx prisma studio        # Abre Prisma Studio
```

### 15.2 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Google OAuth configurado
- [ ] Banco de dados criado e acessível
- [ ] Pasta de uploads com permissões corretas
- [ ] Secrets gerados (SESSION_SECRET, JWT_SECRET)
- [ ] Admin email definido
- [ ] Container rodando e acessível
- [ ] Health check respondendo
- [ ] Primeiro login funcionando
- [ ] Upload de arquivo testado
- [ ] Backup configurado

---

**Documento criado em:** 2025-01-07  
**Versão:** 1.0  
**Status:** Especificação completa para início de desenvolvimento
