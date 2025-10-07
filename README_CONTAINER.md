# MedLog Container (GHCR)

Imagem: `ghcr.io/edalcin/medlog`

## Tags
- `latest` (branch default)
- `main`
- `sha-<commit>`
- `vX.Y.Z` (quando houver tag semver)

## Pull
```bash
docker pull ghcr.io/edalcin/medlog:latest
```

## Variáveis Principais
| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| DATABASE_URL | Sim | URL completa MySQL/MariaDB |
| NEXTAUTH_SECRET | Sim | Chave de sessão JWT |
| NEXTAUTH_URL | Sim | URL pública da aplicação |
| ADMIN_EMAIL | Sim | Email do admin inicial |
| FILES_PATH | Opcional | Path de uploads (default /app/data/uploads) |

## Exemplo (MariaDB externo)
```bash
docker run -d --name medlog \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://medlog:medlog@192.168.1.10:3333/medlog" \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e NEXTAUTH_URL=http://192.168.1.10:3000 \
  -e ADMIN_EMAIL=seu-email@dominio.com \
  -v /mnt/user/appdata/medlog/uploads:/app/data/uploads \
  ghcr.io/edalcin/medlog:latest
```

## Migrations
A imagem executa automaticamente:
```
npx prisma migrate deploy
```
antes de iniciar o servidor.

## Criar usuário admin (se ainda não existir)
Rodar localmente no código fonte:
```bash
ADMIN_PASSWORD='SenhaForte123!' npm run seed:admin
```

## Healthcheck
Endpoint: `/api/health`

## Atualização
```bash
docker pull ghcr.io/edalcin/medlog:latest
docker stop medlog && docker rm medlog
# recriar com comando anterior
```
