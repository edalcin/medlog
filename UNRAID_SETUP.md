# Deploy MedLog no Unraid

## Pré-requisitos

- Docker instalado no Unraid
- Instância MariaDB 11+ rodando (local ou remota)
- Credenciais do banco de dados em mãos

## Configuração Inicial

### 1. Gerar NEXTAUTH_SECRET

```bash
# No terminal do seu computador (Linux/macOS):
openssl rand -base64 32

# Ou use um site como: https://generate-secret.vercel.app/
```

Salve esse valor em local seguro.

### 2. Criar script de setup

No terminal do Unraid, crie o arquivo `unraid-setup.sh` com o conteúdo abaixo, **substituindo os valores entre `< >`**:

```bash
#!/bin/bash
set -e

echo "======================================"
echo "MedLog - Setup no Unraid"
echo "======================================"
echo ""

# Parar container se estiver rodando
echo "[1/4] Parando container existente (se houver)..."
docker stop medlog 2>/dev/null || true
docker rm medlog 2>/dev/null || true
echo "✓ Container removido"
echo ""

# Criar diretório de uploads se não existir
echo "[2/4] Criando diretório de uploads..."
mkdir -p /mnt/user/Storage/appsdata/medlog/
chmod -R 755 /mnt/user/Storage/appsdata/medlog/
echo "✓ Diretório criado: /mnt/user/Storage/appsdata/medlog/"
echo ""

# Criar container com variáveis de ambiente
echo "[3/4] Criando container MedLog..."
docker create \
  --name='medlog' \
  --net='bridge' \
  --pids-limit 2048 \
  -e TZ="America/Sao_Paulo" \
  -e HOST_OS="Unraid" \
  -e HOST_HOSTNAME="<SEU_HOSTNAME_AQUI>" \
  -e HOST_CONTAINERNAME="medlog" \
  -e 'DATABASE_URL'='mysql://<USUARIO>:<SENHA>@<IP_BANCO>:<PORTA>/<BANCO>' \
  -e 'NEXTAUTH_SECRET'='<GERAR_COM_openssl_rand_-base64_32>' \
  -e 'NEXTAUTH_URL'='http://<SEU_IP_UNRAID>:<PORTA_PUBLICA>' \
  -e 'FILES_PATH'='/app/data/uploads' \
  -e 'SKIP_MIGRATIONS'='true' \
  -l net.unraid.docker.managed=dockerman \
  -l net.unraid.docker.webui='http://<SEU_IP_UNRAID>:<PORTA_PUBLICA>' \
  -l net.unraid.docker.icon='http://dalcinweb.s3-website-us-east-1.amazonaws.com/github/icones/doctor.png' \
  -p '<PORTA_PUBLICA>:3000/tcp' \
  -v '/mnt/user/Storage/appsdata/medlog/':'/app/data/uploads':'rw' \
  'ghcr.io/edalcin/medlog:latest'

echo "✓ Container criado"
echo ""

# Iniciar container
echo "[4/4] Iniciando container..."
docker start medlog
echo "✓ Container iniciado"
echo ""

# Aguardar alguns segundos
echo "Aguardando aplicação inicializar..."
sleep 5
echo ""

# Mostrar status
echo "======================================"
echo "Status do Container:"
echo "======================================"
docker ps | grep medlog
echo ""

# Mostrar logs
echo "======================================"
echo "Últimas linhas do log:"
echo "======================================"
docker logs --tail 20 medlog
echo ""

echo "======================================"
echo "✓ Setup concluído!"
echo "======================================"
echo ""
echo "Acesse: http://<SEU_IP_UNRAID>:<PORTA_PUBLICA>"
echo ""
echo "Para ver logs em tempo real:"
echo "  docker logs -f medlog"
echo ""
echo "Para parar o container:"
echo "  docker stop medlog"
echo ""
echo "Para reiniciar o container:"
echo "  docker restart medlog"
echo ""
```

### 3. Variáveis a configurar

Edite o script substituindo:

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `<SEU_HOSTNAME_AQUI>` | `Asilo` | Nome do host Unraid |
| `<USUARIO>` | `medlog` | Usuário do banco de dados |
| `<SENHA>` | `sua_senha_segura` | Senha do banco de dados |
| `<IP_BANCO>` | `192.168.1.10` | IP do servidor MariaDB |
| `<PORTA>` | `3333` | Porta do MariaDB |
| `<BANCO>` | `medlog` | Nome do banco de dados |
| `<NEXTAUTH_SECRET>` | (gerado acima) | Secret gerado com openssl |
| `<SEU_IP_UNRAID>` | `192.168.1.10` | IP do servidor Unraid |
| `<PORTA_PUBLICA>` | `3123` | Porta pública (ajuste conforme necessário) |

### 4. Executar o script

```bash
# No terminal do Unraid:
bash unraid-setup.sh
```

## Update do MedLog

Para atualizar para a versão mais recente:

```bash
# No terminal do Unraid:
docker stop medlog
docker rm medlog
bash unraid-setup.sh
```

Isso baixará a imagem mais recente do registro e reiniciará o container.

## Troubleshooting

### Container não inicia
```bash
docker logs -f medlog
```

### Erro de conexão ao banco
- Verificar se o IP e porta do banco estão corretos
- Testar conectividade: `telnet <IP_BANCO> <PORTA>`

### Erro de inicialização do Next.js
```bash
# Ver logs completos:
docker logs medlog
```

## Segurança

⚠️ **Importante:**
- **Nunca** faça commit do arquivo `unraid-setup.sh` com dados reais no repositório
- Mantenha este arquivo apenas localmente no servidor Unraid
- Use senhas fortes para o banco de dados
- Gere um novo `NEXTAUTH_SECRET` para cada instalação
- Considere usar um firewall para restringir acesso à porta do MedLog
