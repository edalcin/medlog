import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function checkFilesIntegrity() {
  console.log('🔍 Verificando integridade dos arquivos...\n')

  const uploadsDir = process.env.FILES_PATH || path.join(process.cwd(), 'uploads')
  console.log(`📁 Diretório de uploads: ${uploadsDir}\n`)

  // Get all files from database
  const files = await prisma.file.findMany({
    include: {
      consultation: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      category: true,
    },
    orderBy: {
      uploadedAt: 'desc',
    },
  })

  console.log(`📊 Total de arquivos no banco: ${files.length}\n`)

  let missingCount = 0
  let existingCount = 0
  const missingFiles: any[] = []

  for (const file of files) {
    const filePath = path.join(uploadsDir, file.path)
    const exists = fs.existsSync(filePath)

    if (exists) {
      existingCount++
    } else {
      missingCount++
      missingFiles.push({
        id: file.id,
        filename: file.filename,
        customName: file.customName,
        path: file.path,
        consultationId: file.consultationId,
        consultationDate: file.consultation.date,
        user: file.consultation.user.name,
        uploadedAt: file.uploadedAt,
        category: file.category?.name || 'Sem categoria',
      })
      console.log(`❌ FALTANDO: ${file.customName || file.filename}`)
      console.log(`   Path: ${file.path}`)
      console.log(`   ID: ${file.id}`)
      console.log(`   Consulta: ${file.consultationId} (${new Date(file.consultation.date).toLocaleDateString('pt-BR')})`)
      console.log(`   Usuário: ${file.consultation.user.name}`)
      console.log(`   Categoria: ${file.category?.name || 'Sem categoria'}`)
      console.log(`   Upload: ${new Date(file.uploadedAt).toLocaleDateString('pt-BR')}`)
      console.log('')
    }
  }

  console.log('\n📈 Resumo:')
  console.log(`✅ Arquivos encontrados: ${existingCount}`)
  console.log(`❌ Arquivos faltando: ${missingCount}`)
  console.log(`📊 Total no banco: ${files.length}`)
  console.log(`📁 Diretório: ${uploadsDir}`)

  if (missingCount > 0) {
    console.log('\n⚠️  ATENÇÃO: Alguns arquivos estão registrados no banco mas não existem fisicamente!')
    console.log('Possíveis causas:')
    console.log('  1. Volume Docker não está montado corretamente')
    console.log('  2. Arquivos foram deletados manualmente')
    console.log('  3. Uploads feitos antes de configurar o volume corretamente')
    console.log('\nSoluções:')
    console.log('  1. Restaurar os arquivos do backup (se disponível)')
    console.log('  2. Remover registros órfãos do banco de dados')
    console.log('  3. Verificar configuração do volume no Docker')
  }

  // Check for orphaned physical files
  console.log('\n\n🔍 Verificando arquivos órfãos (físicos sem registro no banco)...\n')

  if (fs.existsSync(uploadsDir)) {
    const physicalFiles = fs.readdirSync(uploadsDir)
    const dbPaths = new Set(files.map(f => f.path))
    const orphanedFiles = physicalFiles.filter(f => !dbPaths.has(f))

    if (orphanedFiles.length > 0) {
      console.log(`⚠️  Encontrados ${orphanedFiles.length} arquivo(s) órfão(s):`)
      orphanedFiles.forEach(f => console.log(`   - ${f}`))
      console.log('\nEstes arquivos existem fisicamente mas não estão no banco de dados.')
      console.log('Podem ser deletados com segurança.')
    } else {
      console.log('✅ Nenhum arquivo órfão encontrado.')
    }
  } else {
    console.log(`❌ Diretório de uploads não existe: ${uploadsDir}`)
  }

  await prisma.$disconnect()
}

checkFilesIntegrity()
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
