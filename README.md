# MedLog - Sistema de Registro de Consultas Médicas

> Sistema completo para gerenciamento de histórico médico pessoal e familiar

[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-MVP%20Ready-green.svg)](https://github.com/edalcin/medlog)

---

## 📋 Visão Geral

O MedLog é um sistema web self-hosted para centralizar todo o histórico médico de consultas, exames, laudos, receitas e procedimentos em um único local seguro e organizado.

Projetado especialmente para uso familiar, o sistema permite registrar consultas médicas em texto livre (com suporte a Markdown), fazer upload de PDFs e imagens de exames e resultados, além de gerenciar profissionais de saúde com suas especialidades.

---

## 🚀 Desenvolvimento Local

Esta seção descreve como configurar e executar o projeto em um ambiente de desenvolvimento local.

### Pré-requisitos

*   **Node.js**: Versão 20 ou superior.
*   **npm**: Gerenciador de pacotes do Node.js.
*   **MariaDB**: Versão 11 ou superior, acessível pela rede.

### Passo 1: Clonar e Instalar Dependências

Primeiro, clone o repositório para sua máquina local e instale todas as dependências do projeto.

```bash
git clone https://github.com/edalcin/medlog.git
cd medlog
npm install
```

### Passo 2: Configurar Variáveis de Ambiente

A aplicação precisa de algumas variáveis de ambiente para se conectar ao banco de dados e para segurança.

1.  Copie o arquivo de exemplo `.env.example` para um novo arquivo chamado `.env`. No Windows, você pode usar:
    ```powershell
    copy .env.example .env
    ```
2.  Abra o arquivo `.env` e edite as seguintes variáveis:

| Variável          | Descrição                                                                 | Exemplo de Valor                                            |
| ----------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`    | A URL de conexão completa para o seu banco de dados MariaDB.              | `mysql://medlog:medlog@192.168.1.10:3333/medlog`              |
| `NEXTAUTH_SECRET` | Uma chave secreta para assinar os tokens de sessão. Pode ser qualquer string aleatória. | `openssl rand -base64 32` (comando para gerar uma)          |
| `NEXTAUTH_URL`    | A URL base da sua aplicação local.                                        | `http://localhost:3000`                                     |


### Passo 3: Sincronizar o Banco de Dados

Com o banco de dados MariaDB em execução e o arquivo `.env` configurado, execute o comando abaixo para criar todas as tabelas necessárias no banco de dados.

```bash
npx prisma db push
```

> **Nota sobre `db push` vs `migrate dev`**: Usamos `db push` para configurar rapidamente o banco de dados em desenvolvimento. Ele não cria arquivos de migração, mas é ideal para iniciar o projeto. Se você encontrar um erro sobre `mysql.proc` corrompido, pode ser necessário executar `mysql_upgrade` no seu servidor de banco de dados.

### Passo 4: Criar o Usuário Administrador

Para fazer o primeiro login, você precisa criar um usuário administrador. Execute o comando abaixo no seu terminal.

**Importante:** A sintaxe varia entre PowerShell (Windows) e Bash (Linux/macOS).

*   **No PowerShell (Windows):**
    ```powershell
    $env:ADMIN_PASSWORD='sua_senha_forte'; npm run seed:admin
    ```

*   **No Bash (Linux/macOS):**
    ```bash
    ADMIN_PASSWORD='sua_senha_forte' npm run seed:admin
    ```

Substitua `'sua_senha_forte'` por uma senha de sua escolha. Este comando criará um usuário com as seguintes credenciais:
- **Email:** `admin@example.com`
- **Senha:** A que você definiu no comando.

### Passo 5: Iniciar a Aplicação

Finalmente, inicie o servidor de desenvolvimento:

```bash
npm run dev
```

A aplicação estará disponível em **http://localhost:3000**. Você pode fazer login com o usuário administrador que acabou de criar.

---

## 🔐 Autenticação

O sistema utiliza autenticação de **Email e Senha** gerenciada pelo NextAuth.js. As senhas são armazenadas no banco de dados de forma segura usando hash bcrypt.

---

## 🏗️ Stack Tecnológico

*   **Frontend:** Next.js 14 (App Router), React 18, TypeScript, shadcn/ui, Tailwind CSS
*   **Autenticação:** NextAuth.js
*   **Backend:** Node.js 20+
*   **ORM:** Prisma
*   **Banco de Dados:** MariaDB 11+
*   **Deploy:** Docker (configuração disponível)

---
## 🐳 Deploy com Docker (Avançado)

Para usuários que preferem rodar a aplicação via Docker, um `Dockerfile` e um `docker-compose.yml` estão incluídos. A configuração principal envolve definir as mesmas variáveis de ambiente (`DATABASE_URL`, `NEXTAUTH_SECRET`, etc.) no seu ambiente Docker. Para mais detalhes, consulte o `docker-compose.yml` e o `Dockerfile` no repositório.
