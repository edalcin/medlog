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

MedLog centraliza o histórico médico de consultas, exames, laudos e receitas em um único local seguro e privado. Projetado para uso familiar — cada usuário gerencia seu próprio histórico, com um administrador que tem visão global.

### Funcionalidades

- Registro de consultas com notas em Markdown e avaliação (1–5 estrelas)
- Upload de arquivos (PDF, PNG, JPG — até 10MB por arquivo)
- Gestão de profissionais de saúde com múltiplas especialidades e clínica associada
- Dicionários controlados: especialidades, categorias de arquivo, clínicas
- Criação rápida de profissionais, especialidades e categorias diretamente nos formulários
- Dashboard com estatísticas: consultas por especialidade, clínica, mês e profissional
- Controle de acesso por usuário (roles: ADMIN e USER)
- Painel administrativo com backup e restauração do banco SQLite
- Interface responsiva — funciona no desktop e mobile

---

## Instalação Rápida

### Docker Compose (recomendado)

```bash
# Gerar SESSION_SECRET
openssl rand -base64 32

# Criar compose.yml (veja modelo abaixo)
# Iniciar
docker compose up -d
```

**compose.yml:**

```yaml
services:
  medlog:
    image: ghcr.io/edalcin/medlog:latest
    ports:
      - "3000:3000"
    volumes:
      - /mnt/user/appdata/medlog/db:/data/db
      - /mnt/user/appdata/medlog/uploads:/data/uploads
    environment:
      DATABASE_URL: file:/data/db/medlog.sqlite
      FILES_PATH: /data/uploads
      SESSION_SECRET: "sua_chave_secreta_aqui"
      PORT: 3000
      ADMIN_EMAIL: admin@exemplo.com
      ADMIN_PASSWORD: senha_forte
      SESSION_SECURE: "true"
    restart: unless-stopped
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
