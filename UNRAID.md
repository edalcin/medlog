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
  ghcr.io/edalcin/medlog:latest
```

> `ADMIN_EMAIL` e `ADMIN_PASSWORD` são usados apenas no **primeiro boot** para criar o administrador. Após a criação do usuário, remova essas variáveis por segurança.

### 4. Verificar

```bash
docker logs -f medlog
```

Aguardar a linha `server listening on :3000` e acessar `http://ip-do-unraid:3000`.

---

## Atualização

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

---

## Links

- [Repositório GitHub](https://github.com/edalcin/medlog)
- [Documentação Técnica](./TECHNICAL.md)
