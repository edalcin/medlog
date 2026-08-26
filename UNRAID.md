# MedLog — Instalação no Unraid

O MedLog usa SQLite embutido — **não requer MariaDB ou banco externo**.

---

## Instalação Inicial

### 1. Criar diretórios de dados

No terminal do Unraid:

```bash
mkdir -p /mnt/user/appdata/medlog/db
mkdir -p /mnt/user/appdata/medlog/uploads
```

> O volume único `/mnt/user/appdata/medlog:/app/data` mapeia tanto o banco quanto os uploads. O container espera `$DATABASE_URL` com prefixo `/app/data/db/` e `$FILES_PATH` com `/app/data/uploads/`.

### 2. Gerar SESSION_SECRET

```bash
openssl rand -base64 32
```

Guarde o valor — será usado na variável `SESSION_SECRET`.

### 3. Criar o container

Via **Docker → Add Container** ou pelo terminal:

```bash
docker run -d \
  --name medlog \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /mnt/user/appdata/medlog:/app/data \
  -e DATABASE_URL="file:/app/data/db/medlog.sqlite" \
  -e FILES_PATH="/app/data/uploads" \
  -e SESSION_SECRET="sua_chave_gerada_acima" \
  -e PORT="3000" \
  -e ADMIN_EMAIL="admin@exemplo.com" \
  -e ADMIN_PASSWORD="senha_forte_aqui" \
  -e SESSION_SECURE="true" \
  -e TRUST_PROXY="false" \
  -e GEMINI_API_KEY="sua_chave_do_google_ai_studio" \
  ghcr.io/edalcin/medlog:latest
```

> `ADMIN_EMAIL` e `ADMIN_PASSWORD` são usados apenas no **primeiro boot** para criar o administrador. Após a criação do usuário, remova essas variáveis por segurança.

> `GEMINI_API_KEY` é **opcional** e habilita a extração de indicadores de PDFs de laudo por IA. Sem ela o MedLog funciona por inteiro; o painel admin apenas avisa que a chave está ausente. Na interface do Unraid é uma **Variable** com Key `GEMINI_API_KEY`. A chave é lida só no arranque: depois de adicionar, aplique para o container ser recriado. Qualquer usuário da instância pode extrair os próprios documentos, então a chave é o único controle de gasto: sem ela, ninguém extrai.

### 4. Verificar

```bash
docker logs -f medlog
```

Aguardar a linha `server listening on :3000` e acessar `http://ip-do-unraid:3000`.

---

## Atualização

> **Antes de atualizar, faça backup.** Migrações de banco rodam sozinhas no arranque e algumas não têm volta trivial. A cópia do arquivo `.sqlite` leva segundos e evita o pior.

### Via interface do Unraid (recomendado)

1. Aba **Docker** → **Check for Updates**
2. Clicar **Update** no container `medlog`
3. Migrações do banco rodam automaticamente na inicialização

### Via terminal

```bash
docker stop medlog
docker rm medlog
docker pull ghcr.io/edalcin/medlog:latest
# Re-executar o docker run com as mesmas variáveis
```

**Atualizando para a v3.0:** a migração `007` cria as tabelas de indicadores de saúde, semeia o catálogo com 55 Indicadores e acrescenta `collected_at`, `lab_name` e `report_number` em `files`. Roda sozinha, não pede nada, e não altera dado existente. Para usar a extração, acrescente `GEMINI_API_KEY` no mesmo passo.

**Atualizando para a v3.1:** as migrações `008` e `009` acrescentam `biological_sex` e `birth_date` em `users` (ambas nulas, ninguém é obrigado a preencher) e criam e semeiam `indicator_normal_ranges` com 78 Faixas de normalidade, cada uma citando a fonte. Rodam sozinhas e não alteram dado existente. Sem sexo biológico e data de nascimento no perfil, a tela de Indicadores mostra as faixas possíveis mas não desenha a banda — preencha em **Configurações**.

---

## Backup e Restauração

O sistema possui backup e restauração integrados no painel administrativo (aba **Backup & Restauração**):

- **Download Backup:** baixa o arquivo `.sqlite` com checkpoint WAL aplicado
- **Restaurar:** faz upload de um `.sqlite` válido para substituir o banco atual

Adicionalmente, como o banco é um único arquivo, pode-se copiar diretamente:

```bash
# Backup manual (o banco fica em /mnt/user/appdata/medlog/db/ no host)
cp /mnt/user/appdata/medlog/db/medlog.sqlite /mnt/user/backup/medlog-$(date +%Y%m%d).sqlite

# Verificar logs
docker logs medlog | tail -50
```

---

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | sim | `file:/app/data/db/medlog.sqlite` |
| `FILES_PATH` | sim | Diretório de uploads (ex: `/app/data/uploads`) |
| `SESSION_SECRET` | sim | String aleatória min. 32 chars (`openssl rand -base64 32`) |
| `PORT` | não | Porta do servidor (padrão: `3000`) |
| `ADMIN_EMAIL` | primeiro boot | Email do admin inicial |
| `ADMIN_PASSWORD` | primeiro boot | Senha do admin inicial |
| `SESSION_SECURE` | não | `true` em produção (HTTPS). Padrão: `false` |
| `TRUST_PROXY` | não | `true` se atrás de proxy reverso (ativa X-Forwarded-For para rate limiting). Padrão: `false` |
| `GEMINI_API_KEY` | não | Chave do Google AI Studio. Habilita a extração por IA; ausente, o recurso fica desabilitado |

---

## Troubleshooting

### Container não inicia

```bash
docker logs medlog
```

### Permission denied nos volumes

```bash
# Verificar dono dos diretórios
ls -la /mnt/user/appdata/medlog/

# O container roda como root — se necessário, ajustar permissões
chmod 755 /mnt/user/appdata/medlog/db
chmod 755 /mnt/user/appdata/medlog/uploads
```

### Banco corrompido

```bash
# Parar container
docker stop medlog

# Verificar integridade (banco no host em /mnt/user/appdata/medlog/db/)
sqlite3 /mnt/user/appdata/medlog/db/medlog.sqlite "PRAGMA integrity_check;"

# Restaurar a partir de backup via painel admin ou copiando o arquivo
cp /mnt/user/backup/medlog-20260101.sqlite /mnt/user/appdata/medlog/db/medlog.sqlite

docker start medlog
```

### Entrar no container

```bash
docker exec -it medlog sh
```

### Extração por IA não aparece ou falha

```bash
# A chave é lida só no arranque. Confirme que chegou ao container:
docker exec medlog printenv GEMINI_API_KEY
```

Vazio ou ausente → acrescente a **Variable** `GEMINI_API_KEY` e aplique, para o container ser recriado. O painel admin (aba **Extração por IA**) mostra explicitamente quando a chave está faltando.

Extração parada em "em andamento" depois de um reinício não é progresso: a chamada foi perdida junto com o processo, e o MedLog a marca como falha no arranque seguinte. Basta disparar de novo.

### O PDF não aparece na tela de revisão

O documento é servido corretamente; o que costuma acontecer é o navegador estar configurado para **baixar** PDFs em vez de exibi-los, e então o `<iframe>` fica vazio. A própria tela oferece "Abrir o documento em outra aba".

---

## Links

- [Repositório GitHub](https://github.com/edalcin/medlog)
- [Documentação Técnica](./TECHNICAL.md)
