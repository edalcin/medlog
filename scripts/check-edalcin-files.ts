import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkEdalcinFiles() {
  console.log('📋 Verificando arquivos do usuário edalcin...\n')

  // Find edalcin user
  const user = await prisma.user.findFirst({
    where: {
      email: { contains: 'edalcin' },
    },
  })

  if (!user) {
    console.log('❌ Usuário edalcin não encontrado')
    return
  }

  console.log(`✅ Usuário encontrado: ${user.name} (${user.email})`)
  console.log(`   ID: ${user.id}`)
  console.log(`   Role: ${user.role}\n`)

  // Check files for this user
  const files = await prisma.file.findMany({
    where: {
      userId: user.id,
    },
    include: {
      category: true,
      consultation: {
        select: {
          id: true,
          date: true,
        },
      },
      professional: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  console.log(`📊 Total de arquivos do usuário: ${files.length}\n`)

  if (files.length > 0) {
    console.log('📁 Arquivos:')
    files.forEach((f, idx) => {
      console.log(`\n  ${idx + 1}. ${f.customName || f.filename}`)
      console.log(`     ID: ${f.id}`)
      console.log(`     Categoria: ${f.category?.name || '-'}`)
      if (f.consultation) {
        console.log(`     Consulta: ${new Date(f.consultation.date).toLocaleDateString('pt-BR')}`)
      }
      if (f.professional) {
        console.log(`     Profissional: ${f.professional.name}`)
      }
    })
  } else {
    console.log('⚠️  Nenhum arquivo encontrado para este usuário')
  }

  // Check files with NULL userId
  const orphanedFiles = await prisma.file.count({
    where: {
      userId: null,
    },
  })

  console.log(`\n\n⚠️  Arquivos sem usuário (userId = NULL): ${orphanedFiles}`)

  // Check total files
  const totalFiles = await prisma.file.count()
  console.log(`📊 Total de arquivos no sistema: ${totalFiles}`)

  await prisma.$disconnect()
}

checkEdalcinFiles().catch((error) => {
  console.error('❌ Erro:', error)
  process.exit(1)
})
