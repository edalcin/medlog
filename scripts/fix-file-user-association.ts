import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixFileUserAssociation() {
  console.log('🔧 Reatribuindo arquivos aos usuários corretos...\n')

  // Get all files without userId
  const filesWithoutUser = await prisma.file.findMany({
    where: {
      userId: null,
    },
    include: {
      consultation: {
        select: {
          userId: true,
          date: true,
        },
      },
    },
  })

  console.log(`📊 Total de arquivos sem usuário: ${filesWithoutUser.length}\n`)

  let updated = 0
  let noConsultation = 0

  for (const file of filesWithoutUser) {
    if (file.consultation?.userId) {
      // Update file with userId from consultation
      await prisma.file.update({
        where: { id: file.id },
        data: {
          userId: file.consultation.userId,
        },
      })
      updated++
      console.log(`✅ ${file.filename} → associado ao usuário da consulta`)
    } else {
      noConsultation++
      console.log(`⚠️  ${file.filename} → sem consulta associada (manual fix needed)`)
    }
  }

  console.log(`\n📈 Resumo:`)
  console.log(`✅ Arquivos reatribuídos: ${updated}`)
  console.log(`⚠️  Arquivos sem consulta: ${noConsultation}`)

  // Verify
  const remainingOrphaned = await prisma.file.count({
    where: {
      userId: null,
    },
  })

  console.log(`\n📊 Arquivos ainda sem userId: ${remainingOrphaned}`)

  await prisma.$disconnect()
}

fixFileUserAssociation()
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
