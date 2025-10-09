# MedLog - Sistema de Registro de Consultas Médicas

> Sistema completo para gerenciamento de histórico médico pessoal e familiar, projetado para ser auto-hospedado (self-hosted).

[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-MVP%20Ready-green.svg)](https://github.com/edalcin/medlog)

---

## 🎯 Visão Geral

O MedLog é um sistema web que busca resolver a falta de um local centralizado para o histórico de saúde pessoal e familiar. Ele permite registrar e organizar consultas médicas, resultados de exames, laudos, receitas e informações sobre profissionais de saúde em um único ambiente seguro.

Projetado para rodar em um servidor doméstico (como Unraid) via Docker, ele permite que um pequeno grupo de usuários (uma família) mantenha seus registros médicos de forma privada e acessível, com uma interface moderna e limpa.

---

## ✨ Principais Funcionalidades

A plataforma gira em torno do **Registro da Consulta Médica** como seu evento central.

### 1. Registro de Consulta Detalhado
- **Data e Profissional:** Inicie um registro informando a data da consulta e selecionando um profissional de saúde em uma lista (apenas profissionais ativos são exibidos).
- **Criação Rápida de Profissional:** Se o profissional não estiver na lista, adicione-o diretamente no formulário da consulta para um cadastro rápido. Os detalhes completos podem ser adicionados mais tarde.
- **Notas da Consulta:** Utilize um campo de texto livre com suporte a Markdown para registrar sintomas, diagnósticos, prescrições e orientações.
- **Upload de Arquivos:** Anexe múltiplos documentos (PDF) e imagens (PNG, JPG) à consulta, como receitas, laudos e pedidos de exames.

### 2. Gestão de Profissionais de Saúde
- **Cadastro Completo:** Mantenha uma ficha para cada profissional com nome, especialidade, CRM, telefone e endereço.
- **Status Ativo/Inativo:** Controle quais profissionais aparecem na lista de seleção para novas consultas. Profissionais inativos são mantidos no histórico, mas não podem ser selecionados para novos registros.

### 3. Visualização e Relatórios
O sistema oferece múltiplas formas de acessar e filtrar as informações:
- **Por Consulta:** Veja todos os documentos de uma consulta específica.
- **Por Profissional:** Acesse o histórico completo de consultas e documentos associados a um profissional.
- **Por Especialidade:** Agrupe todas as consultas e documentos de uma mesma especialidade (ex: Ortopedia).
- **Timeline Cronológica:** Navegue por todo o histórico médico em uma linha do tempo.

---

## 🏗️ Stack Tecnológico

*   **Frontend:** Next.js 14 (App Router), React 18, TypeScript, shadcn/ui, Tailwind CSS
*   **Autenticação:** NextAuth.js
*   **Backend:** Node.js 20+
*   **ORM:** Prisma
*   **Banco de Dados:** MariaDB 11+
*   **Deploy:** Docker

---

## 🚀 Desenvolvimento Local

Esta seção descreve como configurar e executar o projeto em um ambiente de desenvolvimento local.

### Pré-requisitos

*   **Node.js**: Versão 20 ou superior.
*   **npm**: Gerenciador de pacotes do Node.js.
*   **MariaDB**: Versão 11 ou superior, acessível pela rede.

### Passo 1: Clonar e Instalar Dependências

```bash
git clone https://github.com/edalcin/medlog.git
cd medlog
npm install
```

### Passo 2: Configurar Variáveis de Ambiente

Copie o arquivo de exemplo `.env.example` para um novo arquivo chamado `.env` e preencha as variáveis necessárias.

```powershell
# No Windows
copy .env.example .env
```
```bash
# No Linux/macOS
cp .env.example .env
```

**Variáveis essenciais:**

| Variável          | Descrição                                            | Exemplo de Valor                                            |
| ----------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`    | URL de conexão para o banco de dados MariaDB.        | `mysql://user:password@hostname:port/database`              |
| `NEXTAUTH_SECRET` | Chave secreta para assinar os tokens de sessão.      | Use `openssl rand -base64 32` para gerar uma.               |
| `NEXTAUTH_URL`    | URL base da sua aplicação local.                     | `http://localhost:3000`                                     |

### Passo 3: Sincronizar o Banco de Dados

Execute o comando abaixo para criar a estrutura de tabelas no banco de dados.

```bash
npx prisma db push
```

### Passo 4: Criar o Usuário Administrador

Execute o comando abaixo para criar o primeiro usuário com perfil de administrador.

*   **No PowerShell (Windows):**
    ```powershell
    $env:ADMIN_PASSWORD='sua_senha_forte'; npm run seed:admin
    ```

*   **No Bash (Linux/macOS):**
    ```bash
    ADMIN_PASSWORD='sua_senha_forte' npm run seed:admin
    ```

O usuário será criado com o email `admin@example.com` e a senha que você definiu.

### Passo 5: Iniciar a Aplicação

```bash
npm run dev
```

A aplicação estará disponível em **http://localhost:3000**.

---

## 🐳 Deploy com Docker (Unraid)

A aplicação é projetada para ser executada via Docker, o que é ideal para ambientes como o Unraid.

1.  **Build da Imagem:**
    ```bash
    docker build -t medlog .
    ```
2.  **Execução:**
    O `docker-compose.yml` fornecido pode ser usado como base. O mais importante é configurar as variáveis de ambiente para o container, apontando para o seu banco de dados e definindo um caminho (volume) para o armazenamento dos arquivos de upload.

    **Exemplo de variáveis de ambiente para o container:**
    - `DATABASE_URL`
    - `NEXTAUTH_SECRET`
    - `NEXTAUTH_URL` (deve ser a URL final da sua aplicação)
    - `UPLOADS_PATH` (caminho dentro do container onde os arquivos serão salvos, ex: `/data/uploads`)

---

## 📄 Licença

Este projeto é distribuído sob a licença MIT.
