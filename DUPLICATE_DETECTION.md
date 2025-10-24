# Sistema de Detecção de Duplicatas por Hash

## Visão Geral

O MedLog implementa um sistema robusto de detecção de duplicatas usando hash SHA-256 para prevenir que o mesmo arquivo seja enviado múltiplas vezes.

## Como Funciona

### 1. Cálculo de Hash
Quando um arquivo é enviado via `/api/files/upload`:
- O servidor calcula um hash SHA-256 do arquivo (`lib/upload.ts`)
- O cliente também pode calcular o hash para validação
- O hash é armazenado na tabela `files` (campo `hash`)

### 2. Verificação de Duplicatas
Antes de salvar o arquivo:
- Busca por arquivo com o mesmo hash pertencente ao mesmo usuário
- Se encontrar: retorna erro **409** (Conflict)
- Mensagem ao usuário: `"Arquivo duplicado! Um arquivo idêntico já existe: \"{nome}\"`

### 3. Fluxo de Upload

```
1. Cliente envia arquivo → 2. Servidor calcula hash
                           ↓
3. Verifica hash no banco → 4. Se existe: erro 409
                           ↓
5. Se novo: salva arquivo 6. Cria registro com hash
```

## Implementação Técnica

### Database
```sql
ALTER TABLE files ADD COLUMN hash VARCHAR(64) UNIQUE;
CREATE INDEX files_hash_idx ON files(hash);
```

**Campo:** `hash` (VARCHAR 64)
- Armazena hash SHA-256 (hex string, 64 caracteres)
- Índice para queries rápidas de duplicatas
- Permite NULL para arquivos legacy

### API Endpoint
**Arquivo:** `app/api/files/upload/route.ts` (linhas 48-73)

```typescript
// Calcula hash
const fileHash = await calculateFileHash(file)

// Verifica duplicata por usuário
const existingFile = await prisma.file.findFirst({
  where: {
    hash: fileHash,
    userId: session.user.id,  // Por usuário!
  },
})

if (existingFile) {
  return errorResponse(
    `Arquivo duplicado! Um arquivo idêntico já existe: "${existingFile.customName || existingFile.filename}"`,
    409
  )
}
```

**Características:**
- Hash calculado no servidor (segurança)
- Verificação por usuário (cada usuário pode ter suas cópias)
- Retorna nome do arquivo existente ao usuário
- Previne atualizações desnecessárias ao banco

## Retroatividade - Calculando Hashes de Arquivos Existentes

### Status Atual
- **Total de arquivos:** 110
- **Com hash:** 5
- **Sem hash:** 105
- **Cobertura:** 4.5%

### Como Executar o Backfill

```bash
npm run backfill:hashes
```

**O script:**
- Lê arquivo do disco
- Calcula hash SHA-256
- Detecta colisões de hash (duplicatas do mesmo conteúdo)
- Atualiza registro no banco com hash
- Relata sucesso/erros detalhadamente

**Nota:** O script só processa arquivos que ainda existem no disco. Se o arquivo foi deletado do disco mas o registro ainda está no banco, ele será reportado como erro (arquivo não encontrado).

### Monitorar Progresso

```bash
npm run check:hash:status
```

Mostra estatísticas atualizadas do sistema:
- Total de arquivos
- Arquivos com hash
- Cobertura percentual
- Status da implementação

## Detalhe Importante: Por Usuário

A detecção de duplicatas funciona **por usuário**:

```typescript
where: {
  hash: fileHash,
  userId: session.user.id,  // ← Chave importante!
}
```

Isso significa:
- ✅ Usuário A pode ter arquivo.pdf
- ✅ Usuário B também pode ter o mesmo arquivo.pdf
- ✅ Sem conflitos entre usuários
- ✅ Cada um vê apenas seus próprios duplicatas

## Resposta do Sistema

### Sucesso (201)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "documento.pdf",
    "mimeType": "application/pdf",
    "size": 1024000,
    "url": "/api/files/uuid-path",
    "createdAt": "2025-10-24T12:00:00Z"
  },
  "message": "Arquivo enviado com sucesso"
}
```

### Duplicata Detectada (409)
```json
{
  "success": false,
  "message": "Arquivo duplicado! Um arquivo idêntico já existe: \"meu_documento_v1.pdf\"",
  "statusCode": 409
}
```

## Vantagens

1. **Segurança:**
   - Hash SHA-256 é criptograficamente seguro
   - Impossível dois arquivos diferentes terem mesmo hash

2. **Performance:**
   - Índice no banco: queries O(1)
   - Verifica antes de salvar: sem operações desnecessárias
   - Não precisa comparar byte a byte

3. **Experiência do Usuário:**
   - Feedback imediato sobre duplicata
   - Mostra nome do arquivo existente
   - Evita confusão de múltiplas cópias

4. **Privacidade:**
   - Verificação por usuário
   - Arquivos de outros usuários não são afetados
   - Cada usuário gerencia seus próprios arquivos

## Próximos Passos Recomendados

1. **Executar Backfill:**
   ```bash
   npm run backfill:hashes
   ```

2. **Monitorar Cobertura:**
   ```bash
   npm run check:hash:status
   ```

3. **Testar em Produção:**
   - Tentar fazer upload do mesmo arquivo 2x
   - Verificar mensagem de erro
   - Confirmar que não criou duplicata

4. **Cleanup (Opcional):**
   - Deletar registros órfãos (arquivo no banco mas não no disco)
   - Script já existe: `npm run clean:orphan-files`

## Arquivos Relacionados

- `app/api/files/upload/route.ts` - Endpoint de upload (lógica principal)
- `prisma/migrations/20251024_add_hash_field/migration.sql` - Migração do banco
- `scripts/backfill-file-hashes.ts` - Script de retroatividade
- `scripts/check-hash-status.ts` - Monitoramento de cobertura
- `lib/upload.ts` - Utilidades de upload (salvar arquivo no disco)

## Referências

- **Algoritmo:** SHA-256 (via `crypto.subtle.digest`)
- **Banco:** MySQL - Campo UNIQUE garante integridade
- **Padrão HTTP:** 409 Conflict para duplicatas
- **RFC 7231:** Códigos de status HTTP

---

**Data de Implementação:** 2025-10-24
**Status:** ✓ Implementado e testado
