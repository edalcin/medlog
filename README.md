<div align="center">
  <img src="public/doctor-icon.png" alt="MedLog Logo" width="120" height="120">
  <h1>MedLog - Sistema de Registro de Consultas Médicas</h1>
  <p><em>Sistema completo para gerenciamento de histórico médico pessoal e familiar</em></p>
</div>

[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://github.com/edalcin/medlog/pkgs/container/medlog)
[![GHCR Image](https://img.shields.io/badge/ghcr.io-edalcin%2Fmedlog-1f425f?logo=github)](https://github.com/users/edalcin/packages/container/package/medlog)
[![GitHub Container Registry](https://img.shields.io/badge/container%20registry-ghcr.io-blue.svg)](https://github.com/edalcin/medlog/pkgs/container/medlog)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-MVP%20Ready-green.svg)](https://github.com/edalcin/medlog)

---

## 📋 Visão Geral

O MedLog é um sistema web self-hosted para centralizar todo o histórico médico de consultas, exames, laudos, receitas e procedimentos em um único local seguro e organizado.

Projetado especialmente para uso familiar, o sistema permite registrar consultas médicas em texto livre (com suporte a Markdown), fazer upload de PDFs e imagens de exames e resultados, além de gerenciar profissionais de saúde com suas especialidades.

### ✅ Principais Funcionalidades

- Registro de consultas médicas com notas em Markdown
- Upload de documentos (PDF, PNG, JPG até 10MB)
- Gestão de profissionais de saúde com múltiplas especialidades
- Categorização de arquivos (Laudos, Receitas, Pedidos de Exame, etc.)
- Associação de profissionais a clínicas/hospitais
- Relatórios e análises do histórico médico
- Controle de acesso por usuário (uso familiar)
- Interface responsiva e moderna

---

## 🐳 Instalação no Unraid

### Pré-requisitos

1. **MariaDB** já rodando (pode ser container separado) com base e usuário criados:
    ```sql
    CREATE DATABASE medlog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'medlog_user'@'%' IDENTIFIED BY 'SUA_SENHA_SEGURA';
    GRANT ALL PRIVILEGES ON medlog.* TO 'medlog_user'@'%';
    FLUSH PRIVILEGES;
    ```

2. **Diretório de uploads** criado no Unraid:
    ```bash
    mkdir -p /mnt/user/appdata/medlog/uploads
    chmod 755 /mnt/user/appdata/medlog/uploads
    ```

### Configuração do Container

1. Acesse o Dashboard do Unraid
2. Vá em: **Docker → Add Container**
3. Configure os seguintes parâmetros:

**Informações Básicas:**
- **Name:** `medlog`
- **Repository:** `ghcr.io/edalcin/medlog:latest`
- **Network:** `bridge` (ou a rede custom que você usa com o banco)
- **WebUI:** `http://[IP]:[PORT:3000]`

**Portas:**
- **Port:** Container `3000` → Host `3000` (TCP)

**Volumes:**
- **Path:** Container `/app/data/uploads` → Host `/mnt/user/appdata/medlog/uploads` (RW)

**Variáveis de Ambiente:**

| Variável | Valor Exemplo | Descrição |
|----------|---------------|-----------|
| `DATABASE_URL` | `mysql://medlog_user:SUA_SENHA@192.168.1.50:3306/medlog` | String de conexão completa com o banco |
| `NEXTAUTH_SECRET` | `(gera com openssl)` | Token para assinatura de sessões JWT |
| `NEXTAUTH_URL` | `http://192.168.1.100:3000` | URL completa onde o app será acessado |
| `FILES_PATH` | `/app/data/uploads` | Caminho interno dos uploads (não alterar) |

### Gerando o NEXTAUTH_SECRET

Execute este comando no terminal do Unraid:

```bash
openssl rand -base64 32
```

Copie o resultado e use como valor da variável `NEXTAUTH_SECRET`.

### Criar Usuário Administrador

Após o container iniciar pela primeira vez, execute:

```bash
docker exec -it medlog npm run seed:admin
```

Será solicitada a senha do administrador. Este será o primeiro usuário do sistema.

---

## 🎯 Primeiro Acesso

1. **Acesse o sistema:** `http://SEU_IP:3000`

2. **Faça login:**
   - Use as credenciais do usuário administrador criado
   - Email e senha definidos no seed

3. **Comece a usar:**
   - Cadastre profissionais de saúde
   - Registre consultas
   - Faça upload de exames e laudos

---

## 📖 Documentação Adicional

- **[Documentação Técnica](TECHNICAL.md)** - Arquitetura, estrutura do banco de dados e desenvolvimento local
- **[Instruções para Claude](CLAUDE.md)** - Guia de desenvolvimento para IA
- **[Especificação Técnica](.specify/inicioDesenv.md)** - Detalhes completos da implementação

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
- **Documentação Técnica:** [TECHNICAL.md](TECHNICAL.md)

---

**Desenvolvido com ❤️ para uso familiar**

**Última atualização: 11 de outubro de 2025**
