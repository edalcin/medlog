#!/bin/bash
# Script para configurar o MedLog no Unraid
# Execute este script no terminal do Unraid

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

# Criar container com SKIP_MIGRATIONS
echo "[3/4] Criando container MedLog..."
docker create \
  --name='medlog' \
  --net='bridge' \
  --pids-limit 2048 \
  -e TZ="America/Sao_Paulo" \
  -e HOST_OS="Unraid" \
  -e HOST_HOSTNAME="Asilo" \
  -e HOST_CONTAINERNAME="medlog" \
  -e 'DATABASE_URL'='mysql://medlog:medlog@192.168.1.10:3333/medlog' \
  -e 'NEXTAUTH_SECRET'='YjE8P7yPkvN9wX2vJ6sZqFp8nQ5rT2uXyA7bC9dE1g=' \
  -e 'NEXTAUTH_URL'='http://192.168.1.10:3123' \
  -e 'FILES_PATH'='/app/data/uploads' \
  -e 'SKIP_MIGRATIONS'='true' \
  -l net.unraid.docker.managed=dockerman \
  -l net.unraid.docker.webui='http://192.168.1.10:3123' \
  -l net.unraid.docker.icon='http://dalcinweb.s3-website-us-east-1.amazonaws.com/github/icones/doctor.png' \
  -p '3123:3000/tcp' \
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
echo "Acesse: http://192.168.1.10:3123"
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
