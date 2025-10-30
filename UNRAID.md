# MedLog - Instalação e Atualização no Unraid

Este guia explica como instalar e atualizar o MedLog no Unraid.

## 📦 Instalação Inicial

### 1. Preparar o script de instalação

```bash
# Baixar o template
wget https://raw.githubusercontent.com/edalcin/medlog/main/unraid-setup.sh.template

# Copiar para o arquivo de trabalho
cp unraid-setup.sh.template unraid-setup.sh

# Editar com suas configurações
nano unraid-setup.sh
```

### 2. Editar as variáveis de ambiente

No arquivo `unraid-setup.sh`, configure:

- **DATABASE_URL**: String de conexão do MariaDB
  ```
  mysql://usuario:senha@ip:porta/database
  ```

- **NEXTAUTH_SECRET**: Gere com o comando:
  ```bash
  openssl rand -base64 32
  ```

- **NEXTAUTH_URL**: URL pública da aplicação
  ```
  https://seu-dominio.com
  ```

- **Volumes e paths**: Ajuste conforme necessário
  ```
  /mnt/user/Storage/appsdata/medlog/
  ```

### 3. Executar a instalação

```bash
bash unraid-setup.sh
```

## 🔄 Atualização

### Opção 1: Via Interface do Unraid (RECOMENDADO)

1. Vá para **Docker** tab
2. Clique em **Check for Updates**
3. Clique em **Update** no container medlog
4. ✅ **Pronto!** As migrações do banco rodam automaticamente

### Opção 2: Via Script (Terminal)

```bash
# Baixar o template (primeira vez)
wget https://raw.githubusercontent.com/edalcin/medlog/main/unraid-update.sh.template
cp unraid-update.sh.template unraid-update.sh

# Editar com as MESMAS configurações do unraid-setup.sh
nano unraid-update.sh

# Executar atualização
bash unraid-update.sh
```

### Opção 3: Manual

```bash
docker stop medlog
docker rm medlog
docker pull ghcr.io/edalcin/medlog:latest
bash unraid-setup.sh
```

## ✅ Por Que Não Preciso Mais Rodar o Script?

### Antes (problema):
- `SKIP_MIGRATIONS=true` estava configurado
- Migrações do banco **não rodavam** automaticamente
- Cada update quebrava a aplicação

### Agora (solução):
- `SKIP_MIGRATIONS` foi **removido**
- Migrações rodam **automaticamente** na inicialização
- Updates via Unraid UI funcionam perfeitamente

## 🔍 Verificar se está funcionando

```bash
# Ver logs em tempo real
docker logs -f medlog

# Verificar se migrações rodaram
docker logs medlog | grep -i migration

# Ver status do container
docker ps | grep medlog
```

## 📝 Comandos Úteis

```bash
# Ver logs
docker logs -f medlog

# Parar container
docker stop medlog

# Iniciar container
docker start medlog

# Reiniciar container
docker restart medlog

# Entrar no container
docker exec -it medlog sh

# Ver versão da imagem
docker inspect medlog | grep Image
```

## ⚠️ Importante

1. **Nunca comite** os arquivos `unraid-setup.sh` e `unraid-update.sh` - eles contêm credenciais
2. **Sempre use os templates** (.template) como base
3. **Mantenha backup** das suas configurações
4. **Teste updates** em ambiente de desenvolvimento primeiro (opcional)

## 🔐 Segurança

Os arquivos de configuração são ignorados pelo git (`.gitignore`):
```
unraid-setup.sh      # Ignorado - contém credenciais
unraid-update.sh     # Ignorado - contém credenciais
```

Apenas os templates são versionados:
```
unraid-setup.sh.template    # Versionado - valores placeholder
unraid-update.sh.template   # Versionado - valores placeholder
```

## 🆘 Troubleshooting

### Erro: "Container não inicia"
```bash
docker logs medlog
```

### Erro: "Cannot connect to database"
Verifique:
- MariaDB está rodando
- Credenciais estão corretas
- Firewall permite conexão

### Erro: "Migrações falharam"
```bash
# Entrar no container
docker exec -it medlog sh

# Rodar migrações manualmente
npx prisma migrate deploy

# Ver status das migrações
npx prisma migrate status
```

## 📚 Links Úteis

- [Repositório GitHub](https://github.com/edalcin/medlog)
- [Documentação Técnica](./TECHNICAL.md)
- [Instruções para Claude](./CLAUDE.md)
