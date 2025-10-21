import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkOrphanedFiles() {
  console.log('📋 Verificando arquivos órfãos (sem userId e sem consulta)...\n')

  const orphanedFiles = await prisma.file.findMany({
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
      professional: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  console.log(`📊 Total de arquivos órfãos: ${orphanedFiles.length}\n`)

  if (orphanedFiles.length > 0) {
    console.log('📁 Arquivos órfãos:')
    orphanedFiles.forEach((f, idx) => {
      console.log(`\n  ${idx + 1}. ${f.customName || f.filename}`)
      console.log(`     ID: ${f.id}`)
      console.log(`     Path: ${f.path}`)
      console.log(`     Tem consulta? ${f.consultation ? 'Sim' : 'Não'}`)
      if (f.consultation) {
        console.log(`     Usuário da consulta: ${f.consultation.userId}`)
      }
      if (f.professional) {
        console.log(`     Profissional: ${f.professional.name}`)
      }
    })
  } else {
    console.log('✅ Nenhum arquivo órfão encontrado!')
  }

  await prisma.$disconnect()
}

checkOrphanedFiles().catch((error) => {
  console.error('❌ Erro:', error)
  process.exit(1)
})
