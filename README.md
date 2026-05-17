<div align="center">
  <img src="frontend/public/doctor-icon.png" alt="MedLog Logo" width="120" height="120">
  <h1>MedLog</h1>
  <p><em>Sistema self-hosted de registro de consultas médicas</em></p>
</div>

[![Go](https://img.shields.io/badge/go-1.24-00ADD8.svg)](https://go.dev/)
[![Svelte](https://img.shields.io/badge/svelte-5-FF3E00.svg)](https://svelte.dev/)
[![SQLite](https://img.shields.io/badge/sqlite-embedded-003B57.svg)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](https://github.com/edalcin/medlog/pkgs/container/medlog)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Visão Geral

MedLog centraliza o histórico médico de consultas, exames, laudos e receitas em um único local seguro e privado. Projetado para uso familiar — cada usuário gerencia seu próprio histórico, com compartilhamento opcional entre membros da família e um administrador com visão global.

### Funcionalidades

**Consultas e Arquivos**
- Registro de consultas com notas em Markdown e avaliação (1–5 estrelas)
- Upload de arquivos (PDF, PNG, JPG — até 10MB por arquivo)
- Categorização de arquivos (laudos, receitas, pedidos de exame, etc.)

**Profissionais e Clínicas**
- Gestão de profissionais de saúde com múltiplas especialidades e clínica associada
- Telefones de contato para profissionais e clínicas
- Busca de profissionais por nome com filtro ativo/inativo
- Criação rápida de profissionais, especialidades, categorias e clínicas diretamente nos formulários

**Compartilhamento**
- Compartilhamento de profissionais e clínicas entre usuários da família
- Profissionais compartilhados são somente leitura para o destinatário

**Dashboard e Relatórios**
- Dashboard com estatísticas: consultas por especialidade, clínica, mês e profissional
- Linha do tempo de consultas e eventos
- Profissionais mais bem avaliados
- Cache automático de 5 minutos para performance

**Configurações de Usuário**
- Tema claro / escuro / sistema (persistido por usuário)
- Alteração de senha pelo próprio usuário

**Administração**
- Painel com visão global: usuários, consultas, profissionais, arquivos
- Gerenciamento de dicionários: especialidades, categorias, clínicas
- Logs de acesso com IP e user-agent
- Backup e restauração do banco SQLite

**Segurança**
- Rate limiting no login (5 tentativas/minuto por IP)
- Content-Security-Policy, X-Frame-Options, HSTS
- Sessões server-side com invalidação automática ao rotacionar SESSION_SECRET
- Timeout de 30s em todas as chamadas de API

---

## Instalação Rápida

### Docker Compose (recomendado)

```bash
# Gerar SESSION_SECRET
openssl rand -base64 32

# Criar .env a partir do exemplo
cp .env.example .env   # edite SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# Iniciar
docker compose up -d
```

**compose.yml para produção:**

```yaml
services:
  medlog:
    image: ghcr.io/edalcin/medlog:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      DATABASE_URL: file:/app/data/db/medlog.sqlite
      FILES_PATH: /app/data/uploads
      SESSION_SECRET: "sua_chave_secreta_aqui"
      PORT: 3000
      ADMIN_EMAIL: admin@exemplo.com
      ADMIN_PASSWORD: senha_forte
      SESSION_SECURE: "true"
      TRUST_PROXY: "false"   # "true" se estiver atrás de nginx/Cloudflare
    restart: unless-stopped
    healthcheck:
      test: ["/medlog", "healthcheck"]
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3
```

> `ADMIN_EMAIL` e `ADMIN_PASSWORD` são usados apenas no **primeiro boot** para criar o usuário administrador. Após a criação, podem ser removidos das variáveis de ambiente.

---

## Documentação

- **[Instalação e Unraid](UNRAID.md)** — guia detalhado para instalar no Unraid
- **[Documentação Técnica](TECHNICAL.md)** — arquitetura, schema do banco, desenvolvimento local

---

## Licença

MIT — veja [LICENSE](LICENSE).

---

**Desenvolvido com ❤️ para uso familiar**
