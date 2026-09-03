<div align="center">
  <img src="frontend/public/doctor-icon.png" alt="MedLog Logo" width="120" height="120">
  <h1>MedLog</h1>
  <p><em>Sistema self-hosted de registro de consultas médicas</em></p>
</div>

[![Go](https://img.shields.io/badge/go-1.25-00ADD8.svg)](https://go.dev/)
[![Svelte](https://img.shields.io/badge/svelte-5-FF3E00.svg)](https://svelte.dev/)
[![SQLite](https://img.shields.io/badge/sqlite-embedded-003B57.svg)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](https://git.dalc.in/edalcin/-/packages/container/medlog)
[![Gemini](https://img.shields.io/badge/gemini-opcional-8E75B2.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Visão Geral

MedLog centraliza o histórico médico de consultas, exames, laudos e receitas em um único local seguro e privado. Projetado para uso familiar — cada usuário gerencia seu próprio histórico, com compartilhamento opcional entre membros da família e um administrador com visão global. Desde a v3.0, extrai também os indicadores de saúde de dentro dos PDFs de laudo, com revisão humana antes de o dado valer.

### Funcionalidades

**Consultas e Arquivos**
- Registro de consultas com notas em Markdown e avaliação (1–5 estrelas)
- Upload de arquivos (PDF, PNG, JPG — até 10MB por arquivo)
- Categorização de arquivos (laudos, receitas, pedidos de exame, etc.)

**Indicadores de Saúde (v3.0 – v3.1)**
- Extração dos valores de um PDF de laudo por IA (Gemini), a partir de documento **já anexado** no sistema
- Catálogo global de 55 Indicadores semeado na instalação (hemograma, lipidograma, função renal, tireoide, etc.)
- Revisão obrigatória: o dono do documento confere a lista inteira ao lado do PDF e confirma ou rejeita em bloco — valor não revisado não aparece em lugar nenhum
- Leitura do laudo evolutivo: as coletas anteriores impressas no próprio documento viram série histórica
- Série temporal por Indicador em gráfico interativo (Chart.js, empacotado — nunca por CDN), com tooltip por ponto e clique para abrir o laudo de origem
- Faixa de normalidade por sexo biológico e idade, pesquisada em fonte citável e distinta da faixa impressa no laudo — banda desenhada no gráfico quando o perfil resolve um candidato único
- Um documento guarda uma extração: a nova substitui a anterior, e o link **zerar** apaga tudo daquele documento para recomeçar com outro modelo
- Valor com qualificador (`>90`, `normais`) é guardado fiel e listado, nunca convertido em número

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
- Sexo biológico e data de nascimento, usados só para resolver a Faixa de normalidade dos Indicadores — nunca enviados ao provedor de IA

**Administração**
- Painel com visão global: usuários, consultas, profissionais, arquivos
- Gerenciamento de dicionários: especialidades, categorias, clínicas
- Logs de acesso com IP e user-agent
- Backup e restauração do banco SQLite
- Escolha do modelo de IA usado na extração, com o custo estimado por laudo ao lado de cada opção

**Segurança e Privacidade**
- Rate limiting no login (5 tentativas/minuto por IP)
- Content-Security-Policy, X-Frame-Options, HSTS
- Sessões server-side com invalidação automática ao rotacionar SESSION_SECRET
- Timeout de 30s em todas as chamadas de API
- Nenhum documento sai do servidor sem consentimento explícito, por documento, registrado com autor e data
- A chave da API de IA vive só no ambiente do processo; nunca é gravada no banco nem exposta pela interface

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
    image: git.dalc.in/edalcin/medlog:latest
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
      GEMINI_API_KEY: "sua_chave_do_google_ai_studio"   # opcional — habilita a extração por IA
      TRUST_PROXY: "false"   # "true" se estiver atrás de nginx/Cloudflare
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "/medlog", "healthcheck"]
      interval: 30s
      timeout: 3s
      start_period: 10s
      retries: 3
```

> `ADMIN_EMAIL` e `ADMIN_PASSWORD` são usados apenas no **primeiro boot** para criar o usuário administrador. Após a criação, podem ser removidos das variáveis de ambiente.

> `GEMINI_API_KEY` é **opcional**. Sem ela o MedLog funciona por inteiro, apenas com a extração por IA desabilitada — o painel admin avisa que a chave está ausente. Use uma chave de **tier pago**: no Free Tier o Google usa o conteúdo enviado para melhorar os produtos dele, e o laudo carrega nome completo e data de nascimento.

---

## Extraindo indicadores de um laudo

Requer `GEMINI_API_KEY` no ambiente. Cada usuário extrai os **próprios** documentos; o administrador alcança os de todos.

1. **Admin → Extração por IA** — o administrador escolhe o modelo, que vale para a instância inteira. O padrão é `gemini-3.1-flash-lite`, cerca de US$ 0,02 por laudo de 16 páginas; o custo estimado de cada opção aparece ao lado
2. **Arquivos** — no PDF do laudo, dispare a extração e confirme o diálogo de consentimento. O documento precisa já estar anexado: não há upload nesse caminho
3. A chamada dura minutos e roda no servidor; a tela acompanha o andamento sozinha
4. **Revisão** — confira a lista inteira contra o PDF exibido ao lado e confirme ou rejeite em bloco. Rejeitar descarta os valores e preserva a Extração, que continua auditável
5. **Indicadores** — a série temporal passa a mostrar o que foi confirmado, incluindo as coletas antigas lidas do laudo evolutivo
6. Quer recomeçar do zero, com outro modelo? Em **Arquivos**, o link **zerar** ao lado da extração apaga a extração e todas as Observações daquele documento, confirmadas inclusive. Extrações não se acumulam: uma nova sempre substitui a anterior do mesmo documento

O que o modelo não souber mapear vira pendência na tela de revisão, nunca um Indicador inventado. Promover um analito novo ao catálogo é decisão explícita do `ADMIN`.

---

## Documentação

- **[Instalação e Unraid](UNRAID.md)** — guia detalhado para instalar no Unraid
- **[Documentação Técnica](TECHNICAL.md)** — arquitetura, schema do banco, desenvolvimento local
- **[Vocabulário do domínio](CONTEXT.md)** — o que é Indicador, Observação, Laudo, Procedência, Revisão
- **[Decisões de arquitetura](docs/adr/)** — ADRs, incluindo as que governam privacidade e revisão da extração

---

## Licença

MIT — veja [LICENSE](LICENSE).

---

**Desenvolvido com ❤️ para uso familiar**
