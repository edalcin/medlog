# PDF Thumbnail Generation - Abordagem Bem-Sucedida

## 📋 Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Problema Original](#problema-original)
3. [Tentativas Falhadas](#tentativas-falhadas)
4. [Solução Final (Bem-Sucedida)](#solução-final-bem-sucedida)
5. [Implementação Técnica](#implementação-técnica)
6. [Requisitos do Docker](#requisitos-do-docker)
7. [Como Usar](#como-usar)
8. [Troubleshooting](#troubleshooting)
9. [Commits Relacionados](#commits-relacionados)

---

## Resumo Executivo

**Objetivo:** Gerar thumbnails de arquivos PDF para exibição rápida na interface do usuário.

**Problema:** Incompatibilidade entre `pdfjs-dist` e o bundling do Next.js em ambiente de produção.

**Solução:** Usar `pdftoppm` (ferramenta CLI do pacote `poppler-utils`) via `child_process` do Node.js.

**Status:** ✅ **FUNCIONAL E TESTADO EM PRODUÇÃO**

---

## Problema Original

### Contexto
O projeto precisava gerar thumbnails de PDFs para exibir na interface ao lado de imagens. A primeira tentativa foi usar `pdfjs-dist` (a implementação JavaScript oficial do PDF.js), que é multiplataforma e não requer dependências externas.

### Por que Falhou

```
Error: Setting up fake worker failed: "Cannot find module '/app/.next/server/chunks/pdf.worker.mjs'"
```

**Causa raiz:**
1. O Next.js bundlava todo o `pdfjs-dist` durante a build
2. Arquivos foram movidos para `/app/.next/server/chunks/`
3. O arquivo worker (`pdf.worker.mjs`) ficou em um local que não era acessível em runtime
4. Quando pdf.js tentava carregar o worker, procurava em um lugar que não existia

**Por que é difícil de resolver:**
- O worker é necessário para processamento assíncrono
- A configuração `workerSrc` é frágil e sensível ao environment
- Em ambientes Docker bundled, é especialmente problemático

---

## Tentativas Falhadas

### ❌ Tentativa 1: Configurar workerSrc Diretamente

```typescript
// Não funciona em produção
pdfjs.GlobalWorkerOptions.workerSrc = '/app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
```

**Problema:** Em produção, pdfjs-dist foi bundlado, então o arquivo não existe em `node_modules/`.

---

### ❌ Tentativa 2: Marcar como External no Webpack

```javascript
// next.config.js
config.externals = [..., 'pdfjs-dist']
```

**Problema:** Mesmo marcando como external, o Next.js ainda conseguia bundlar partes dele ou havia conflitos com o worker.

---

### ❌ Tentativa 3: Desabilitar Worker

```typescript
const doc = await pdfjs.getDocument({
  data: uint8Array,
  disableWorker: true
}).promise
```

**Problema:** Mesmo com `disableWorker: true`, o pdf.js tentava carregar o worker de qualquer forma internamente, causando erro.

---

### ❌ Tentativa 4: Converter Buffer para Uint8Array

```typescript
const uint8Array = new Uint8Array(pdfData)
const doc = await pdfjs.getDocument({ data: uint8Array }).promise
```

**Problema:** Resolveu o erro de Buffer vs Uint8Array, mas não o problema do worker em si.

---

## Solução Final (Bem-Sucedida)

### 🎯 Conceito Central

**Trocar pdfjs-dist (biblioteca JavaScript complexa) por pdftoppm (ferramenta CLI simples).**

```typescript
// ✅ FUNCIONA PERFEITAMENTE
const { execFile } = await import('child_process')
const { promisify } = await import('util')
const execFileAsync = promisify(execFile)

await execFileAsync('pdftoppm', [
  '-singlefile',
  '-f', '1', '-l', '1',
  '-png',
  '-W', '200', '-H', '200',
  filePath,
  thumbnailPath,
])
```

### Por que Funciona

1. **Simplicidade:** pdftoppm é uma ferramenta CLI externa, não uma biblioteca JavaScript
2. **Sem bundling:** É executada via `child_process`, não pelo Next.js
3. **Confiabilidade:** Poppler é a base do Ghostscript, usado em produção há anos
4. **Portabilidade:** Funciona em Linux, macOS e Windows
5. **Performance:** Mais rápido que renderizar com canvas

### Vantagens Sobre pdfjs-dist

| Aspecto | pdfjs-dist | pdftoppm |
|---------|-----------|----------|
| Bundling | ❌ Problemático | ✅ Não afetado |
| Dependências | Zero (JS puro) | poppler-utils |
| Linhas de Código | ~70 | ~25 |
| Complexidade | Alta | Baixa |
| Confiabilidade | Instável em Docker | Muito estável |
| Performance | Lenta (render canvas) | Rápida (CLI) |

---

## Implementação Técnica

### 1. Arquivo: `lib/thumbnail-generator.ts`

```typescript
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'
const THUMBNAILS_DIR = join(UPLOAD_DIR, 'thumbnails')

export async function generatePdfThumbnail(
  filePath: string,
  fileName: string,
  options: { width?: number; height?: number } = {}
): Promise<string> {
  try {
    console.log(`[PDF Thumbnail] Starting generation for: ${filePath}`)

    await mkdir(THUMBNAILS_DIR, { recursive: true })
    console.log(`[PDF Thumbnail] Thumbnails directory ready: ${THUMBNAILS_DIR}`)

    const width = options.width || 200
    const height = options.height || 200

    console.log(`[PDF Thumbnail] Using pdftoppm to convert PDF...`)

    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)

    const thumbnailFilename = `${randomUUID()}.png`
    const thumbnailPath = join(THUMBNAILS_DIR, thumbnailFilename)

    console.log(`[PDF Thumbnail] Executing pdftoppm...`)

    try {
      // Tenta com parâmetros de tamanho primeiro
      await execFileAsync('pdftoppm', [
        '-singlefile',
        '-f', '1',
        '-l', '1',
        '-png',
        '-W', width.toString(),
        '-H', height.toString(),
        filePath,
        thumbnailPath,
      ])

      console.log(`[PDF Thumbnail] Thumbnail saved: ${thumbnailPath}.png`)
      return `${thumbnailFilename}.png`
    } catch (execError) {
      // Fallback: tenta sem parâmetros de tamanho
      console.log(`[PDF Thumbnail] Retrying without size parameters...`)
      await execFileAsync('pdftoppm', [
        '-singlefile',
        '-f', '1',
        '-l', '1',
        '-png',
        filePath,
        thumbnailPath,
      ])

      console.log(`[PDF Thumbnail] Thumbnail saved: ${thumbnailPath}.png`)
      return `${thumbnailFilename}.png`
    }
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error)

    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('ENOENT') || errorMsg.includes('pdftoppm')) {
      throw new Error(
        'PDF thumbnail generation failed: pdftoppm not found. ' +
        'Please ensure poppler-utils is installed in your Docker image. ' +
        'Add this to your Dockerfile: RUN apt-get update && apt-get install -y poppler-utils'
      )
    }

    throw new Error(`Failed to generate thumbnail for PDF: ${errorMsg}`)
  }
}
```

### 2. Opções do pdftoppm

```bash
pdftoppm [opções] arquivo.pdf output_prefix
```

| Opção | Significado |
|-------|-------------|
| `-singlefile` | Gera um arquivo único ao invés de múltiplos (um por página) |
| `-f 1` | Primeira página a processar |
| `-l 1` | Última página a processar |
| `-png` | Formato de saída: PNG |
| `-W 200` | Largura máxima em pixels |
| `-H 200` | Altura máxima em pixels |

---

## Requisitos do Docker

### Alpine Linux (Recomendado)

```dockerfile
# Use Alpine 3.19+ (baseado em node:20-alpine3.19)
FROM node:20-alpine3.19

# Instale as dependências
RUN apk add --no-cache \
  cairo \              # Para canvas (imagens)
  jpeg \               # Suporte a JPEG
  pango \              # Renderização de texto
  giflib \             # Suporte a GIF
  pixman \             # Biblioteca gráfica
  libc6-compat \       # Compatibilidade
  poppler-utils        # ← ESSENCIAL para PDF
```

### Debian/Ubuntu

```dockerfile
FROM node:20

# Instale as dependências
RUN apt-get update && apt-get install -y \
  libpng-dev \
  libjpeg-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libgif-dev \
  poppler-utils        # ← ESSENCIAL para PDF
```

### Verificar Instalação

```bash
# Dentro do container
pdftoppm -version

# Deve mostrar algo como:
# pdftoppm version 24.01.0
```

---

## Como Usar

### 1. No Admin Panel

**Painel Administrativo → Arquivos → Selecione um PDF → Clique "Gerar Thumbnail"**

```
✅ Antes: PDF sem thumbnail (ícone genérico)
⬇️
✅ Depois: Thumbnail da primeira página do PDF
```

### 2. No Menu Principal

**Menu Principal → Arquivos → Clique no PDF → Clique em "Editar" → "Gerar Thumbnail"**

```
Mesma funcionalidade disponível para usuários regulares
```

### 3. Logs para Verificar

```
[PDF Thumbnail] Starting generation for: /app/data/uploads/...
[PDF Thumbnail] Thumbnails directory ready: /app/data/uploads/thumbnails
[PDF Thumbnail] Using pdftoppm to convert PDF...
[PDF Thumbnail] Executing pdftoppm...
[PDF Thumbnail] Thumbnail saved: /app/data/uploads/thumbnails/...
```

### 4. Verificar Arquivo Gerado

```bash
# Dentro do container
ls -lah /app/data/uploads/thumbnails/

# Deve mostrar arquivos .png gerados
# -rw-r--r-- 1 nextjs nodejs 45K Jan 1 12:00 abc123-def456.png
```

---

## Troubleshooting

### ❌ Erro: `spawn pdftoppm ENOENT`

**Causa:** `poppler-utils` não está instalado

**Solução:**
```dockerfile
# Alpine
RUN apk add --no-cache poppler-utils

# Debian
RUN apt-get install -y poppler-utils
```

---

### ❌ Erro: `pdftoppm: command not found`

**Causa:** Similar ao acima, mas detectado de forma diferente

**Solução:** Mesmo que acima. Verify com:
```bash
docker exec medlog pdftoppm -version
```

---

### ❌ Erro: `cannot open output file`

**Causa:** Permissões insuficientes no diretório de thumbnails

**Solução:**
```bash
# Dentro do container
chmod 755 /app/data/uploads/thumbnails
chown -R nextjs:nodejs /app/data/uploads
```

---

### ❌ PDF Corrompido ou Inválido

**Causa:** Arquivo PDF não é válido

**Solução:**
```bash
# Teste com pdftoppm manualmente
docker exec medlog pdftoppm -f 1 -l 1 /app/data/uploads/file.pdf /tmp/test

# Se falhar, o PDF está corrompido
# Peça ao usuário para reenviar o arquivo
```

---

### ⚠️ Lento para PDFs Grandes

**Causa:** PDFs com muitas páginas ou resolução alta

**Solução:** Reduzir qualidade
```typescript
// Remova os parâmetros -W e -H para deixar pdftoppm usar defaults
await execFileAsync('pdftoppm', [
  '-singlefile', '-f', '1', '-l', '1', '-png',
  filePath, thumbnailPath,
])
```

---

## Commits Relacionados

### Build and Implementation

```
ed119fd fix: Adicionar poppler-utils ao Docker e melhorar erro de pdftoppm não encontrado
75c19aa refactor: Trocar pdfjs-dist por pdftoppm para geração de thumbnails de PDF
0793d72 fix: Marcar pdfjs-dist como external no webpack para evitar bundling
1f2e8b3 fix: Desabilitar worker explicitamente ao processar PDF com dados diretos
7404e8c fix: Converter Buffer para Uint8Array para compatibilidade com pdf.js
5a48da6 fix: Resolver problema de workerSrc passando buffer ao invés de arquivo path
c570784 fix: Resolver erro 'Invalid workerSrc type' na geração de thumbnail para PDF
```

### Interface Unification (Relacionado)

```
76df1a3 feat: Unificar interface de edição de arquivo em Menu Principal e Painel Admin
```

---

## Referências

- **poppler-utils:** https://poppler.freedesktop.org/
- **pdftoppm documentation:** Man pages in container
- **Alpine Package Search:** https://pkgs.alpinelinux.org/package/edge/community/x86_64/poppler-utils

---

## Conclusão

Esta abordagem é:

✅ **Simples** - Apenas uma chamada CLI
✅ **Robusto** - Usado em produção por anos
✅ **Rápido** - Mais rápido que JS rendering
✅ **Confiável** - Sem problemas com bundling
✅ **Documentado** - Você está lendo!

**Use com confiança em produção.** 🚀
