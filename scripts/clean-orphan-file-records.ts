import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

const prisma = new PrismaClient()

async function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function cleanOrphanFileRecords() {
  console.log('🧹 Verificando registros órfãos de arquivos...\n')

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
            },
          },
        },
      },
      category: true,
    },
  })

  console.log(`📊 Total de arquivos no banco: ${files.length}\n`)

  const missingFiles: any[] = []

  for (const file of files) {
    const filePath = path.join(uploadsDir, file.path)
    const exists = fs.existsSync(filePath)

    if (!exists) {
      missingFiles.push(file)
    }
  }

  if (missingFiles.length === 0) {
    console.log('✅ Nenhum registro órfão encontrado. Todos os arquivos no banco existem fisicamente.')
    await prisma.$disconnect()
    return
  }

  console.log(`❌ Encontrados ${missingFiles.length} registro(s) órfão(s):\n`)

  missingFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file.customName || file.filename}`)
    console.log(`   Path: ${file.path}`)
    console.log(`   Consulta: ${new Date(file.consultation.date).toLocaleDateString('pt-BR')}`)
    console.log(`   Usuário: ${file.consultation.user.name}`)
    console.log(`   Categoria: ${file.category?.name || 'Sem categoria'}`)
    console.log('')
  })

  console.log(`\n⚠️  ATENÇÃO: ${missingFiles.length} arquivo(s) estão registrados no banco mas não existem fisicamente.\n`)

  const answer = await askQuestion('Deseja remover estes registros do banco de dados? (sim/não): ')

  if (answer.toLowerCase() !== 'sim' && answer.toLowerCase() !== 's') {
    console.log('\n❌ Operação cancelada.')
    await prisma.$disconnect()
    return
  }

  console.log('\n🗑️  Removendo registros órfãos...\n')

  let deletedCount = 0
  for (const file of missingFiles) {
    try {
      await prisma.file.delete({
        where: { id: file.id },
      })
      deletedCount++
      console.log(`✅ Removido: ${file.customName || file.filename}`)
    } catch (error) {
      console.error(`❌ Erro ao remover ${file.customName || file.filename}:`, error)
    }
  }

  console.log(`\n✅ Operação concluída!`)
  console.log(`📊 Registros removidos: ${deletedCount} de ${missingFiles.length}`)

  await prisma.$disconnect()
}

cleanOrphanFileRecords()
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
