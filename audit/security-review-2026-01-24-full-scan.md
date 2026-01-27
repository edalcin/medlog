# Relatório de Análise de Segurança - MedLog

**Projeto**: MedLog - Sistema de Rastreamento de Consultas Médicas
**Tech Stack**: Next.js 14 (App Router), React 18, TypeScript, Prisma ORM, MariaDB 11+, NextAuth.js, Tailwind CSS
**Data da Revisão**: 2026-01-24
**Tipo de Análise**: Análise Completa de Segurança (Autenticação, Autorização, Injeção, Arquivos, OWASP Top 10)

---

## Sumário Executivo

O sistema MedLog é uma aplicação de gerenciamento de dados médicos sensíveis que apresenta uma **arquitetura de segurança sólida** com uso adequado de Prisma ORM (proteção contra SQL Injection), NextAuth.js (autenticação robusta) e controle de acesso baseado em roles.

**Pontos Fortes Identificados**:
- Uso de Prisma ORM previne SQL Injection
- Autenticação com NextAuth.js e JWT
- Hash de senhas com bcrypt (10 rounds)
- Validação de propriedade de recursos (consultations, files)
- Middleware de autenticação protegendo rotas

**Vulnerabilidades Críticas**: 0
**Vulnerabilidades Altas**: 3 (1 corrigida)
**Vulnerabilidades Médias**: 6
**Vulnerabilidades Baixas**: 5
**Boas Práticas Encontradas**: 8

### Correções Aplicadas

| Data | Vulnerabilidade | Commit | Arquivo |
|------|-----------------|--------|---------|
| 2026-01-27 | #2 - Ausência de Headers de Segurança HTTP | `0ed0f2c` | `middleware.ts` |

---

## Vulnerabilidades Encontradas

### 🔴 ALTA PRIORIDADE

#### 1. **Path Traversal em Download de Arquivos e Thumbnails**
**Severidade**: ALTA
**CWE**: CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)
**Arquivo**: `app/api/files/download/[path]/route.ts` e `app/api/files/thumbnail/[path]/route.ts`

**Descrição**:
Os endpoints de download de arquivos e thumbnails utilizam o parâmetro `path` diretamente do URL sem validação adequada contra path traversal. Um atacante poderia potencialmente acessar arquivos fora do diretório permitido usando sequências como `../../../`.

**Código Afetado**:
```typescript
// app/api/files/download/[path]/route.ts - Linha 22
const filename = params.path
const filePath = getFullFilePath(filename)

// app/api/files/thumbnail/[path]/route.ts - Linhas 19-21
const thumbnailFilename = params.path
const uploadsDir = process.env.FILES_PATH || './uploads'
const thumbnailPath = join(uploadsDir, 'thumbnails', thumbnailFilename)
```

**Impacto**: Um atacante autenticado poderia potencialmente acessar arquivos arbitrários do sistema se conseguir manipular o path.

**Recomendação**:
```typescript
import { basename, normalize } from 'path'

// Validar e sanitizar o filename
function sanitizeFilename(filename: string): string {
  // Remove path traversal sequences
  const sanitized = basename(normalize(filename))

  // Validar formato UUID.extensão
  const validPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(pdf|png|jpg|jpeg)$/i
  if (!validPattern.test(sanitized)) {
    throw new ValidationError('Nome de arquivo inválido')
  }

  return sanitized
}

// Usar na função:
const filename = sanitizeFilename(params.path)
const filePath = getFullFilePath(filename)
```

---

#### 2. ~~**Ausência de Headers de Segurança HTTP**~~ ✅ CORRIGIDO
**Severidade**: ALTA → **RESOLVIDO**
**CWE**: CWE-693 (Protection Mechanism Failure)
**Arquivo**: `middleware.ts`
**Data da Correção**: 2026-01-27
**Commit**: `0ed0f2c`

**Descrição**:
A aplicação não implementa headers de segurança HTTP essenciais como Content-Security-Policy (CSP), X-Frame-Options, Strict-Transport-Security (HSTS), X-Content-Type-Options, e Referrer-Policy. Isso expõe o sistema a ataques como XSS, clickjacking e outros.

**Impacto**:
- **XSS**: Sem CSP, scripts maliciosos podem ser injetados
- **Clickjacking**: Sem X-Frame-Options, a aplicação pode ser incorporada em iframes maliciosos
- **MITM**: Sem HSTS, conexões podem ser rebaixadas para HTTP

**Recomendação**:
```typescript
// middleware.ts - Adicionar após linha 1
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const response = NextResponse.next()

    // Security Headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    )
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
    )

    return response
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        const publicPaths = ['/', '/auth/signin']
        if (publicPaths.includes(pathname) || pathname.startsWith('/api/auth')) {
          return true
        }
        return !!token
      },
    },
  }
)
```

**Nota**: A política CSP acima precisa ser ajustada conforme as necessidades reais da aplicação, especialmente para `unsafe-inline` e `unsafe-eval` que devem ser removidos quando possível.

> **✅ CORREÇÃO APLICADA (2026-01-27)**: Headers de segurança implementados em `middleware.ts` com CSP usando `unsafe-inline` e `unsafe-eval` para compatibilidade com Next.js. Inclui: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security e Content-Security-Policy.

---

#### 3. **Ausência de Rate Limiting em Endpoints Críticos**
**Severidade**: ALTA
**CWE**: CWE-307 (Improper Restriction of Excessive Authentication Attempts)
**Arquivo**: `app/api/auth/[...nextauth]/route.ts`, endpoints de API em geral

**Descrição**:
Não há implementação de rate limiting em endpoints críticos, especialmente no endpoint de autenticação. Isso permite ataques de força bruta contra senhas de usuários e potencial DoS (Denial of Service).

**Impacto**:
- Ataques de força bruta contra credenciais
- Enumeração de usuários
- Potencial sobrecarga do servidor

**Recomendação**:
Implementar rate limiting usando bibliotecas como `@upstash/ratelimit` ou `express-rate-limit`:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.REDIS_URL || 'memory://localhost',
  token: process.env.REDIS_TOKEN || '',
})

export const loginRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 tentativas a cada 15 minutos
  analytics: true,
})

export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests por minuto
  analytics: true,
})

// Usar em lib/auth/config.ts antes de authorize()
export const authOptions: NextAuthOptions = {
  // ... config existente
  providers: [
    CredentialsProvider({
      async authorize(credentials, req) {
        // Rate limiting por IP
        const identifier = req?.headers?.['x-forwarded-for'] || 'anonymous'
        const { success } = await loginRateLimiter.limit(identifier)

        if (!success) {
          throw new Error('Muitas tentativas de login. Tente novamente em 15 minutos.')
        }

        // ... restante do código
      }
    })
  ]
}
```

---

### 🟡 MÉDIA PRIORIDADE

#### 4. **Inconsistência no Uso de bcrypt (require vs import)**
**Severidade**: MÉDIA
**CWE**: CWE-1104 (Use of Unmaintained Third Party Components)
**Arquivos**: `app/api/users/route.ts` (linha 51), `app/api/users/[id]/route.ts` (linha 72)

**Descrição**:
Há inconsistência no uso de bcrypt: alguns arquivos usam `require('bcryptjs')` dinamicamente, enquanto outros usam `import { hash, compare } from 'bcryptjs'`. O uso de `require` dinâmico pode causar problemas de tipo e manutenção.

**Código Afetado**:
```typescript
// app/api/users/route.ts - Linha 51
const bcrypt = require('bcryptjs')
const passwordHash = await bcrypt.hash(password, 10)

// Comparar com app/api/users/settings/route.ts - Linha 5
import { compare, hash } from 'bcryptjs'
```

**Recomendação**:
Padronizar o uso de import ES6 em todos os arquivos:

```typescript
// No topo do arquivo
import { hash } from 'bcryptjs'

// No código
const passwordHash = await hash(password, 10)
```

---

#### 5. **Falta de Validação de Força de Senha**
**Severidade**: MÉDIA
**CWE**: CWE-521 (Weak Password Requirements)
**Arquivos**: `app/api/users/route.ts`, `app/api/users/[id]/route.ts`

**Descrição**:
A criação de usuários por administradores não valida a força da senha. Apenas o endpoint de configurações pessoais (`app/api/users/settings/route.ts`) valida mínimo de 8 caracteres.

**Código Afetado**:
```typescript
// app/api/users/route.ts - Linha 28-32
const { name, username, email, role, password } = body

if (!name || !username || !email || !password) {
  return NextResponse.json({ error: 'Name, username, email and password are required' }, { status: 400 })
}
// Sem validação de força de senha
```

**Recomendação**:
```typescript
// Criar lib/validation/password.ts
import { z } from 'zod'

export const passwordSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
  .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número')
  .regex(/[^A-Za-z0-9]/, 'Senha deve conter ao menos um caractere especial')

export const userCreateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  username: z.string().min(3, 'Username deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  role: z.enum(['ADMIN', 'USER']).optional(),
  password: passwordSchema,
})

// Usar no endpoint:
const validatedData = userCreateSchema.parse(body)
```

---

#### 6. **Exposição de Stack Traces em Logs de Erro**
**Severidade**: MÉDIA
**CWE**: CWE-209 (Generation of Error Message Containing Sensitive Information)
**Arquivos**: Múltiplos arquivos de API

**Descrição**:
Diversos endpoints utilizam `console.error()` para logar erros, o que pode expor stack traces completas em ambiente de produção, revelando informações sobre a estrutura interna do código.

**Código Afetado**:
```typescript
// lib/responses.ts - Linha 42
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error) // Stack trace completo exposto
  // ...
}
```

**Recomendação**:
Implementar um sistema de logging estruturado que oculte detalhes sensíveis em produção:

```typescript
// lib/logger.ts
const isProduction = process.env.NODE_ENV === 'production'

export function logError(error: unknown, context?: string) {
  if (isProduction) {
    // Em produção, logar apenas mensagem e contexto
    console.error({
      message: error instanceof Error ? error.message : 'Unknown error',
      context,
      timestamp: new Date().toISOString(),
    })
  } else {
    // Em desenvolvimento, logar tudo
    console.error('Error:', error)
    if (context) console.error('Context:', context)
  }
}

// Usar em lib/responses.ts
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  logError(error, 'API Error')

  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode)
  }

  // Não expor detalhes internos em produção
  const message = isProduction ? 'Erro interno do servidor' : (error instanceof Error ? error.message : 'Unknown error')
  return errorResponse(message, 500)
}
```

---

#### 7. **Falta de Validação de MIME Type Real dos Arquivos**
**Severidade**: MÉDIA
**CWE**: CWE-434 (Unrestricted Upload of File with Dangerous Type)
**Arquivo**: `lib/upload.ts`

**Descrição**:
A validação de tipo de arquivo depende apenas do campo `file.type` enviado pelo cliente, que pode ser facilmente falsificado. Não há verificação dos "magic bytes" reais do arquivo.

**Código Afetado**:
```typescript
// lib/upload.ts - Linhas 21-25
export async function saveUploadedFile(file: File): Promise<UploadedFile> {
  // Validate file type
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
  if (!allowedTypes.includes(file.type)) { // Validação apenas do MIME type declarado
    throw new Error('Tipo de arquivo não permitido.')
  }
```

**Recomendação**:
```typescript
import { readFile } from 'fs/promises'

// Verificar magic bytes
async function verifyFileType(buffer: Buffer, declaredType: string): Promise<boolean> {
  const magicNumbers = {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/png': [0x89, 0x50, 0x4E, 0x47], // PNG
    'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG
  }

  const magic = magicNumbers[declaredType as keyof typeof magicNumbers]
  if (!magic) return false

  return magic.every((byte, index) => buffer[index] === byte)
}

// Usar após salvar o arquivo:
const bytes = await file.arrayBuffer()
const buffer = Buffer.from(bytes)

// Verificar magic bytes antes de aceitar
const isValidType = await verifyFileType(buffer, file.type)
if (!isValidType) {
  throw new Error('Tipo de arquivo não corresponde ao conteúdo.')
}
```

---

#### 8. **Ausência de Verificação de Tamanho Total de Uploads por Usuário**
**Severidade**: MÉDIA
**CWE**: CWE-770 (Allocation of Resources Without Limits)
**Arquivo**: `app/api/files/upload/route.ts`

**Descrição**:
Embora haja limite de 10MB por arquivo, não há controle sobre o tamanho total de arquivos que um usuário pode fazer upload, permitindo esgotamento de espaço em disco.

**Recomendação**:
```typescript
// Adicionar ao modelo Prisma uma função de verificação
async function checkUserStorageQuota(userId: string, newFileSize: number): Promise<boolean> {
  const MAX_USER_STORAGE = 1024 * 1024 * 1024 // 1GB por usuário

  const userFiles = await prisma.file.aggregate({
    where: { userId },
    _sum: { size: true },
  })

  const currentUsage = userFiles._sum.size || 0
  return (currentUsage + newFileSize) <= MAX_USER_STORAGE
}

// Usar em app/api/files/upload/route.ts antes de salvar
const hasQuota = await checkUserStorageQuota(session.user.id, file.size)
if (!hasQuota) {
  return errorResponse('Cota de armazenamento excedida. Entre em contato com o administrador.', 413)
}
```

---

#### 9. **Possível Race Condition em Verificação de Duplicatas**
**Severidade**: MÉDIA
**CWE**: CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization)
**Arquivo**: `app/api/files/upload/route.ts`

**Descrição**:
O processo de verificação de duplicatas e upload de arquivo não é atômico, permitindo que dois uploads simultâneos do mesmo arquivo possam passar pela verificação.

**Código Afetado**:
```typescript
// app/api/files/upload/route.ts - Linhas 74-130
let existingFile = await prisma.file.findFirst({ where: { hash: fileHash } })
// ... verificações ...
if (existingFile) {
  return errorResponse('Arquivo duplicado!', 409)
}
// Sem transação entre verificação e criação
const uploadedFile = await saveUploadedFile(file)
const fileRecord = await prisma.file.create({ ... })
```

**Recomendação**:
```typescript
// Usar transação Prisma e unique constraint
try {
  const result = await prisma.$transaction(async (tx) => {
    // Verificar duplicata dentro da transação
    const existingFile = await tx.file.findFirst({
      where: { hash: fileHash, userId: session.user.id },
    })

    if (existingFile) {
      throw new ValidationError(`Arquivo duplicado: "${existingFile.customName || existingFile.filename}"`)
    }

    // Salvar arquivo físico
    const uploadedFile = await saveUploadedFile(file)

    // Criar registro
    return await tx.file.create({
      data: { /* ... */ },
    })
  })

  return successResponse(result, 'Arquivo enviado com sucesso', 201)
} catch (error) {
  // Se falhar, deletar arquivo físico
  // Implementar cleanup
}
```

---

### 🟢 BAIXA PRIORIDADE

#### 10. **Falta de Logging de Auditoria em Operações Críticas**
**Severidade**: BAIXA
**CWE**: CWE-778 (Insufficient Logging)
**Arquivos**: Diversos endpoints de API

**Descrição**:
Operações sensíveis como criação/exclusão de usuários, alteração de roles, e exclusão de consultas não são registradas em logs de auditoria, dificultando investigações de incidentes de segurança.

**Impacto**: Impossibilidade de rastrear ações maliciosas ou não autorizadas.

**Recomendação**:
```typescript
// Criar modelo de AuditLog no schema.prisma
model AuditLog {
  id        String   @id @default(uuid())
  userId    String
  action    String   // 'CREATE_USER', 'DELETE_CONSULTATION', etc.
  resource  String   // 'User', 'Consultation', etc.
  resourceId String?
  details   Json?    // Detalhes adicionais
  ipAddress String?
  timestamp DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([timestamp])
  @@map("audit_logs")
}

// Criar função helper
async function logAudit(params: {
  userId: string
  action: string
  resource: string
  resourceId?: string
  details?: any
  ipAddress?: string
}) {
  await prisma.auditLog.create({ data: params })
}

// Usar em operações críticas:
await logAudit({
  userId: session.user.id,
  action: 'DELETE_USER',
  resource: 'User',
  resourceId: params.id,
  ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
})
```

---

#### 10. **Falta de Proteção CSRF Explícita em State-Changing APIs**
**Severidade**: BAIXA
**CWE**: CWE-352 (Cross-Site Request Forgery)
**Arquivos**: Endpoints POST/PUT/DELETE em `/app/api`

**Descrição**:
Embora NextAuth.js forneça alguma proteção CSRF para suas próprias rotas, as APIs customizadas não implementam verificação explícita de CSRF tokens para operações que alteram estado (POST, PUT, DELETE).

**Nota**: Next.js 14 com App Router e uso de fetch() do lado do cliente oferece alguma proteção natural, mas não é explícita.

**Recomendação**:
NextAuth.js já fornece proteção CSRF para suas rotas. Para APIs customizadas, considerar:

```typescript
// lib/csrf.ts
import { getServerSession } from 'next-auth'
import { authOptions } from './auth/config'

export async function verifyCsrfToken(request: Request): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session) return false

  // NextAuth já gerencia CSRF tokens via cookies
  // Para proteção adicional, verificar header customizado
  const requestOrigin = request.headers.get('origin')
  const requestHost = request.headers.get('host')

  if (requestOrigin && requestHost) {
    return new URL(requestOrigin).host === requestHost
  }

  return true
}
```

**Nota**: Como a aplicação já usa NextAuth.js com estratégia JWT e todas as requisições requerem autenticação, o risco CSRF é mitigado. No entanto, para máxima segurança, considerar implementar SameSite cookies e validação de origem.

---

#### 11. **Ausência de Timeout em Sessões JWT**
**Severidade**: BAIXA
**CWE**: CWE-613 (Insufficient Session Expiration)
**Arquivo**: `lib/auth/config.ts`

**Descrição**:
A configuração do NextAuth não define explicitamente maxAge para sessões JWT, usando valores padrão.

**Recomendação**:
```typescript
// lib/auth/config.ts
export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 horas
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 horas
  },
  // ... restante da config
}
```

---

#### 12. **Falta de Validação de Extensão de Arquivo no Servidor**
**Severidade**: BAIXA
**CWE**: CWE-646 (Reliance on File Name or Extension)
**Arquivo**: `lib/upload.ts`

**Descrição**:
A extensão do arquivo é extraída diretamente do nome fornecido pelo cliente sem validação adicional.

**Código Afetado**:
```typescript
// lib/upload.ts - Linha 37
const fileExtension = file.name.split('.').pop()
const uniqueFilename = `${randomUUID()}.${fileExtension}`
```

**Recomendação**:
```typescript
// Validar extensão explicitamente
const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg']
const fileExtension = file.name.split('.').pop()?.toLowerCase()

if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
  throw new Error('Extensão de arquivo não permitida.')
}

// Verificar se extensão corresponde ao MIME type
const extensionMimeMap: Record<string, string[]> = {
  'pdf': ['application/pdf'],
  'png': ['image/png'],
  'jpg': ['image/jpeg'],
  'jpeg': ['image/jpeg'],
}

if (!extensionMimeMap[fileExtension]?.includes(file.type)) {
  throw new Error('Extensão não corresponde ao tipo de arquivo.')
}
```

---

#### 13. **Variáveis de Ambiente Sensíveis sem Validação na Inicialização**
**Severidade**: BAIXA
**CWE**: CWE-2 (Environment-based Security Flaws)
**Arquivos**: `.env.example`, código que usa `process.env`

**Descrição**:
Não há validação de que variáveis de ambiente críticas estão definidas na inicialização da aplicação.

**Recomendação**:
```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  FILES_PATH: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

export const env = envSchema.parse(process.env)

// Usar em vez de process.env direto:
// import { env } from '@/lib/env'
// const dbUrl = env.DATABASE_URL
```

---

#### 14. **Falta de Content-Type Validation em Respostas de Arquivo**
**Severidade**: BAIXA
**CWE**: CWE-79 (Cross-site Scripting via Content-Type)
**Arquivo**: `app/api/files/download/[path]/route.ts`

**Descrição**:
O Content-Type da resposta é baseado diretamente no `file.mimeType` armazenado no banco de dados, sem validação adicional.

**Código Afetado**:
```typescript
// app/api/files/download/[path]/route.ts - Linha 55
headers: {
  'Content-Type': file.mimeType, // Sem validação
```

**Recomendação**:
```typescript
// Validar MIME type antes de usar
const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg']
const safeMimeType = allowedMimeTypes.includes(file.mimeType)
  ? file.mimeType
  : 'application/octet-stream'

headers: {
  'Content-Type': safeMimeType,
  'X-Content-Type-Options': 'nosniff',
```

---

## Boas Práticas Já Implementadas

### ✅ 1. **Uso de Prisma ORM para Prevenção de SQL Injection**
A aplicação utiliza Prisma ORM exclusivamente para acesso ao banco de dados, eliminando completamente o risco de SQL Injection tradicional. Não foram encontradas queries SQL diretas em nenhum endpoint.

**Exemplo**:
```typescript
// Todas as queries usam Prisma
const user = await prisma.user.findUnique({ where: { email: credentials.email } })
const consultations = await prisma.consultation.findMany({ where, include: { ... } })
```

---

### ✅ 2. **Hash de Senhas com bcrypt**
Todas as senhas são armazenadas usando bcrypt com 10 rounds de salt, fornecendo boa proteção contra ataques de força bruta offline.

**Exemplo**:
```typescript
// lib/auth/config.ts - Linha 22
const valid = await bcrypt.compare(credentials.password, user.passwordHash)

// app/api/users/route.ts - Linha 52
const passwordHash = await bcrypt.hash(password, 10)
```

---

### ✅ 3. **Controle de Acesso Baseado em Roles (RBAC)**
O sistema implementa corretamente verificação de roles (ADMIN/USER) em endpoints sensíveis:

**Exemplo**:
```typescript
// app/api/users/route.ts - Linhas 8-11
const session = await getServerSession(authOptions)
if (session?.user?.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

### ✅ 4. **Verificação de Propriedade de Recursos**
Todas as operações em recursos (consultas, arquivos) verificam que o usuário tem permissão para acessá-los:

**Exemplo**:
```typescript
// app/api/consultations/[id]/route.ts - Linhas 62-65
if (consultation.userId !== session.user.id && session.user.role !== 'ADMIN') {
  return errorResponse('Não autorizado', 403)
}
```

---

### ✅ 5. **Middleware de Autenticação**
Middleware global protege todas as rotas exceto páginas públicas específicas:

**Exemplo**:
```typescript
// middleware.ts
export default withAuth(
  function middleware(req) { ... },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const publicPaths = ['/', '/auth/signin']
        if (publicPaths.includes(pathname) || pathname.startsWith('/api/auth')) {
          return true
        }
        return !!token
      },
    },
  }
)
```

---

### ✅ 6. **Sanitização de Markdown com react-markdown**
O conteúdo Markdown é renderizado usando `react-markdown` com `remarkGfm`, que escapa HTML por padrão, prevenindo XSS:

**Exemplo**:
```typescript
// app/consultations/[id]/page.tsx - Linha 243
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {consultation.notes}
</ReactMarkdown>
```

**Nota**: `react-markdown` é seguro por padrão e não permite HTML inline, prevenindo XSS.

---

### ✅ 7. **Validação de Entrada com Zod**
Alguns endpoints utilizam Zod para validação de schema de entrada:

**Exemplo**:
```typescript
// app/api/users/settings/route.ts - Linhas 8-13
const updatePersonalDataSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  email: z.string().email('Email inválido').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').optional(),
})

const validatedData = updatePersonalDataSchema.parse(body)
```

---

### ✅ 8. **Proteção contra Open Redirect**
NextAuth.js implementa verificação de redirecionamento apenas para URLs do mesmo domínio:

**Exemplo**:
```typescript
// lib/auth/config.ts - Linhas 61-68
async redirect({ url, baseUrl }) {
  // Permite redirecionamentos para URLs relativas
  if (url.startsWith('/')) return `${baseUrl}${url}`
  // Só permite redirecionamentos para o mesmo domínio
  else if (new URL(url).origin === baseUrl) return url
  // Fallback para home
  return baseUrl
}
```

---

### ✅ 9. **Arquivos .env no .gitignore**
Arquivos de configuração sensíveis estão corretamente excluídos do controle de versão:

**Exemplo**:
```gitignore
# .gitignore - Linhas 1-4
# Environment variables
.env
.env.local
.env.production
```

---

### ✅ 10. **Validação de Data no Futuro**
O sistema valida que consultas não podem ter data no futuro:

**Exemplo**:
```typescript
// app/api/consultations/route.ts - Linhas 164-171
const consultationDate = new Date(date)
const now = new Date()
if (isNaN(consultationDate.getTime())) {
  throw new ValidationError('Data inválida')
}
if (consultationDate > now) {
  throw new ValidationError('Data da consulta ou evento não pode ser no futuro')
}
```

---

## Verificação de OWASP Top 10 (2021)

### A01:2021 – Broken Access Control
**Status**: ✅ **BEM IMPLEMENTADO** (com ressalvas)

**Positivo**:
- Middleware de autenticação global
- Verificação de roles (ADMIN/USER)
- Validação de propriedade de recursos
- Verificação de compartilhamento de profissionais/clínicas

**Atenção**:
- Implementar rate limiting (vulnerabilidade #3)
- Adicionar auditoria de acessos (vulnerabilidade #10)

---

### A02:2021 – Cryptographic Failures
**Status**: ✅ **ADEQUADO**

**Positivo**:
- Senhas hasheadas com bcrypt (10 rounds)
- JWT para sessões
- Hash SHA-256 para detecção de duplicatas de arquivos

**Recomendações**:
- Implementar HSTS para forçar HTTPS (vulnerabilidade #2)
- Considerar criptografia em repouso para dados médicos sensíveis no banco

---

### A03:2021 – Injection
**Status**: ✅ **EXCELENTE**

**Positivo**:
- Uso exclusivo de Prisma ORM (SQL Injection protegido)
- Nenhuma query SQL direta encontrada
- Markdown sanitizado via react-markdown

**Atenção**:
- Path traversal em downloads (vulnerabilidade #1)

---

### A04:2021 – Insecure Design
**Status**: ⚠️ **NECESSITA MELHORIAS**

**Atenção**:
- Falta de rate limiting (vulnerabilidade #3)
- Falta de quota de armazenamento (vulnerabilidade #8)
- Ausência de logging de auditoria (vulnerabilidade #10)

---

### A05:2021 – Security Misconfiguration
**Status**: ⚠️ **PARCIALMENTE CORRIGIDO**

**Corrigido**:
- ✅ ~~Ausência total de security headers~~ (vulnerabilidade #2) - **Corrigido em 2026-01-27**

**Atenção**:
- Stack traces expostos em logs (vulnerabilidade #6)
- Validação de variáveis de ambiente faltando (vulnerabilidade #13)

**Próximo Passo**: Implementar logging estruturado para produção.

---

### A06:2021 – Vulnerable and Outdated Components
**Status**: ✅ **ADEQUADO**

Dependências principais estão atualizadas:
- Next.js: 14.2.33 (recente)
- Prisma: 5.15.0 (recente)
- NextAuth.js: 4.24.7 (recente)
- bcryptjs: 2.4.3 (estável)

**Recomendação**: Executar `npm audit` regularmente e manter dependências atualizadas.

---

### A07:2021 – Identification and Authentication Failures
**Status**: ⚠️ **BOM, MAS NECESSITA MELHORIAS**

**Positivo**:
- Autenticação robusta com NextAuth.js
- Senha hasheada com bcrypt
- Validação de senha atual ao trocar senha

**Atenção**:
- Falta de rate limiting (vulnerabilidade #3)
- Validação de força de senha fraca (vulnerabilidade #5)
- Timeout de sessão não explícito (vulnerabilidade #11)

---

### A08:2021 – Software and Data Integrity Failures
**Status**: ✅ **ADEQUADO**

**Positivo**:
- Verificação de hash de arquivos para detectar duplicatas
- JWT assinado para sessões
- Prisma migrations para controle de schema

**Recomendação**: Implementar verificação de magic bytes (vulnerabilidade #7)

---

### A09:2021 – Security Logging and Monitoring Failures
**Status**: ❌ **INSUFICIENTE**

**Atenção**:
- Login básico registrado em `LoginLog`
- **Falta de auditoria de operações críticas** (vulnerabilidade #10)
- Logs não estruturados
- Ausência de alertas de segurança

**Recomendação Urgente**: Implementar sistema de auditoria completo.

---

### A10:2021 – Server-Side Request Forgery (SSRF)
**Status**: ✅ **NÃO APLICÁVEL**

Não foram encontradas funcionalidades que façam requisições HTTP baseadas em input do usuário.

---

## Privacidade de Dados Médicos (LGPD/GDPR)

### Aspectos de Conformidade

#### ✅ **Pontos Positivos**:

1. **Minimização de Dados**: Sistema coleta apenas dados necessários
2. **Controle de Acesso**: Usuários só acessam seus próprios dados (exceto ADMIN)
3. **Segurança no Transporte**: NextAuth.js requer HTTPS em produção
4. **Cascade Deletes**: Exclusão de usuário remove todos os dados associados

#### ⚠️ **Pontos de Atenção**:

1. **Falta de Criptografia em Repouso**: Dados médicos sensíveis não são criptografados no banco
2. **Logs Podem Conter Dados Sensíveis**: `console.error` pode expor informações médicas
3. **Ausência de Funcionalidade de Exportação de Dados**: LGPD Art. 18 requer portabilidade
4. **Falta de Consentimento Explícito**: Não há registro de consentimento do titular
5. **Ausência de DPO/Encarregado**: Não há configuração de responsável pela proteção de dados

#### 📋 **Recomendações LGPD/GDPR**:

```typescript
// 1. Adicionar modelo de Consentimento
model Consent {
  id          String   @id @default(uuid())
  userId      String
  purpose     String   // "Armazenamento de dados médicos"
  granted     Boolean
  grantedAt   DateTime @default(now())
  revokedAt   DateTime?
  user        User     @relation(fields: [userId], references: [id])

  @@map("consents")
}

// 2. Implementar endpoint de exportação de dados (Art. 18, IV)
// GET /api/users/export-data
export async function GET(request: NextRequest) {
  const session = await requireAuth()

  const userData = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      consultations: { include: { files: true } },
      professionals: true,
      // ... todos os dados
    },
  })

  return new Response(JSON.stringify(userData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="meus-dados-${Date.now()}.json"`,
    },
  })
}

// 3. Implementar exclusão completa (Art. 18, VI - Direito ao esquecimento)
// DELETE /api/users/delete-all-data
export async function DELETE(request: NextRequest) {
  const session = await requireAuth()

  await prisma.$transaction(async (tx) => {
    // Deletar arquivos físicos
    const files = await tx.file.findMany({ where: { userId: session.user.id } })
    for (const file of files) {
      await deletePhysicalFile(file.path)
    }

    // Deletar usuário (cascade deletes cuidam do resto)
    await tx.user.delete({ where: { id: session.user.id } })
  })

  // Logout
  await signOut({ redirect: false })

  return successResponse({}, 'Todos os seus dados foram excluídos permanentemente')
}

// 4. Criptografar campos sensíveis
// Adicionar em prisma/schema.prisma comentários sobre dados sensíveis:
model Consultation {
  // @sensitive
  notes String? @db.Text
  // @sensitive
  proposito String?
  // ...
}

// Implementar criptografia em nível de aplicação para campos sensíveis
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY! // 32 bytes
const algorithm = 'aes-256-gcm'

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':')
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  )

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

---

## Checklist de Verificação

### Autenticação e Autorização
- [x] Autenticação implementada (NextAuth.js)
- [x] Hash de senhas (bcrypt)
- [x] Controle de acesso baseado em roles
- [x] Middleware de autenticação global
- [ ] **Rate limiting em login** (PENDENTE - Alta prioridade)
- [ ] **Validação de força de senha** (PENDENTE - Média prioridade)
- [x] Verificação de senha atual ao trocar senha
- [ ] **Timeout de sessão explícito** (PENDENTE - Baixa prioridade)

### Injeção e Validação
- [x] Uso de ORM (Prisma) previne SQL Injection
- [x] Validação de entrada com Zod (parcial)
- [x] Markdown sanitizado (react-markdown)
- [ ] **Validação de path traversal** (PENDENTE - Alta prioridade)
- [ ] **Validação de MIME type real** (PENDENTE - Média prioridade)
- [ ] **Validação de extensão de arquivo** (PENDENTE - Baixa prioridade)

### Gerenciamento de Arquivos
- [x] Validação de tipo de arquivo (MIME)
- [x] Validação de tamanho (10MB)
- [x] Nomes únicos (UUID)
- [x] Verificação de hash para duplicatas
- [x] Controle de acesso a arquivos
- [ ] **Sanitização de path** (PENDENTE - Alta prioridade)
- [ ] **Quota de armazenamento** (PENDENTE - Média prioridade)
- [ ] **Verificação de magic bytes** (PENDENTE - Média prioridade)

### Segredos e Configurações
- [x] .env no .gitignore
- [x] Variáveis de ambiente usadas corretamente
- [ ] **Validação de env na inicialização** (PENDENTE - Baixa prioridade)
- [x] NEXTAUTH_SECRET configurado

### Headers de Segurança
- [x] **Content-Security-Policy** ✅ Implementado em 2026-01-27 (com unsafe-inline/unsafe-eval para Next.js)
- [x] **X-Frame-Options** ✅ Implementado em 2026-01-27
- [x] **HSTS** ✅ Implementado em 2026-01-27
- [x] **X-Content-Type-Options** ✅ Implementado em 2026-01-27
- [x] **Referrer-Policy** ✅ Implementado em 2026-01-27

### Logging e Auditoria
- [x] Registro de logins (LoginLog)
- [ ] **Auditoria de operações críticas** (PENDENTE - Baixa prioridade)
- [ ] **Logging estruturado** (PENDENTE - Média prioridade)
- [ ] **Ocultação de stack traces em produção** (PENDENTE - Média prioridade)

### LGPD/GDPR
- [x] Controle de acesso a dados pessoais
- [x] Exclusão em cascata
- [ ] **Criptografia em repouso** (PENDENTE - Recomendado)
- [ ] **Exportação de dados** (PENDENTE - Obrigatório LGPD)
- [ ] **Registro de consentimento** (PENDENTE - Obrigatório LGPD)
- [ ] **Direito ao esquecimento** (PENDENTE - Obrigatório LGPD)

---

## Recomendações Priorizadas

### 🔴 **Urgente (Implementar em 1-2 semanas)**

1. ~~**Implementar Security Headers** (Vulnerabilidade #2)~~ ✅ **CONCLUÍDO em 2026-01-27**
   - ~~CSP, X-Frame-Options, HSTS, X-Content-Type-Options~~
   - ~~Impacto: Proteção contra XSS, Clickjacking, MITM~~

2. **Corrigir Path Traversal** (Vulnerabilidade #1)
   - Sanitizar paths de download de arquivos
   - Impacto: Prevenir acesso não autorizado a arquivos do sistema

3. **Implementar Rate Limiting** (Vulnerabilidade #3)
   - Especialmente em endpoints de autenticação
   - Impacto: Prevenir força bruta e DoS

### 🟡 **Importante (Implementar em 1 mês)**

4. **Padronizar Uso de bcrypt** (Vulnerabilidade #4)
5. **Validação de Força de Senha** (Vulnerabilidade #5)
6. **Logging Estruturado** (Vulnerabilidade #6)
7. **Validação de MIME Type Real** (Vulnerabilidade #7)
8. **Quota de Armazenamento** (Vulnerabilidade #8)

### 🟢 **Recomendado (Implementar em 2-3 meses)**

9. **Sistema de Auditoria** (Vulnerabilidade #10)
10. **Proteção CSRF Explícita** (Vulnerabilidade #11)
11. **Conformidade LGPD** (Exportação de dados, Consentimento)

---

## Ferramentas de Segurança Recomendadas

### Para Desenvolvimento
```bash
# 1. Análise de dependências
npm audit
npm audit fix

# 2. Análise estática de código
npm install -D eslint-plugin-security
npm install -D @typescript-eslint/eslint-plugin

# 3. Verificação de secrets
npm install -D detect-secrets

# 4. Análise de headers de segurança (em produção)
# https://securityheaders.com
# curl -I https://seu-dominio.com
```

### Para Testes de Segurança
```bash
# 1. OWASP ZAP
# https://www.zaproxy.org/

# 2. Burp Suite (Community Edition)
# https://portswigger.net/burp/communitydownload

# 3. SQLMap (verificar proteção contra SQL injection)
# https://sqlmap.org/

# 4. Nikto (scan de vulnerabilidades web)
nikto -h http://localhost:3000
```

### Para Monitoramento em Produção
```bash
# 1. Snyk (vulnerabilidades em dependências)
# https://snyk.io/

# 2. Sentry (monitoramento de erros)
# https://sentry.io/

# 3. LogRocket (session replay e monitoring)
# https://logrocket.com/
```

---

## Exemplo de Configuração .eslintrc.json com Regras de Segurança

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:security/recommended"
  ],
  "plugins": ["security"],
  "rules": {
    "security/detect-object-injection": "warn",
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-unsafe-regex": "error",
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "warn",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-non-literal-require": "warn",
    "security/detect-possible-timing-attacks": "warn",
    "security/detect-pseudoRandomBytes": "error"
  }
}
```

---

## Conclusão

O sistema MedLog apresenta uma **base de segurança sólida**, especialmente no que diz respeito à prevenção de SQL Injection (uso de Prisma ORM), autenticação robusta (NextAuth.js com bcrypt) e controle de acesso baseado em roles.

**Principais Pontos Fortes**:
- Arquitetura bem estruturada
- Uso correto de ORM
- Autenticação e autorização implementadas
- Boas práticas de validação em vários pontos

**Principais Gaps de Segurança**:
1. ~~**Ausência completa de security headers HTTP**~~ ✅ CORRIGIDO em 2026-01-27
2. **Vulnerabilidade de path traversal** em downloads de arquivos (ALTA)
3. **Falta de rate limiting** permitindo força bruta (ALTA)
4. **Ausência de auditoria** para conformidade e investigação de incidentes
5. **Conformidade LGPD incompleta** (exportação de dados, consentimento)

**Recomendação Geral**:
Implementar as correções restantes de **ALTA PRIORIDADE** (path traversal, rate limiting) antes de colocar o sistema em produção com dados reais de pacientes. As vulnerabilidades de média e baixa prioridade devem ser endereçadas no roadmap de desenvolvimento, especialmente aquelas relacionadas à conformidade com LGPD.

**Risco Atual**: MÉDIO (para dados médicos sensíveis) - reduzido após implementação de security headers
**Risco Após Correções de Alta Prioridade Restantes**: BAIXO-MÉDIO

---

## Referências

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Application Security Verification Standard (ASVS)](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [NextAuth.js Security Documentation](https://next-auth.js.org/configuration/options#security)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [LGPD - Lei Geral de Proteção de Dados](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [GDPR - General Data Protection Regulation](https://gdpr.eu/)
- [CWE - Common Weakness Enumeration](https://cwe.mitre.org/)

---

**Data do Relatório**: 2026-01-24
**Última Atualização**: 2026-01-27
**Analista**: Claude Sonnet 4.5 (Security Audit Agent)
**Versão do Relatório**: 1.1

### Histórico de Atualizações
| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0 | 2026-01-24 | Relatório inicial |
| 1.1 | 2026-01-27 | Vulnerabilidade #2 (Headers de Segurança) marcada como corrigida |
