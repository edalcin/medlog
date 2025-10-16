import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkExistingFiles() {
  const existingPaths = [
    '20dce65c-8913-4162-8644-79d06de9e0ff.pdf',
    '801c921f-c1df-4ad1-b2e8-8d8ba0e526fe.pdf',
    '81943e04-39fe-495d-8ea9-a5e0b07f13aa.pdf',
    '8e709200-15af-4bf6-b451-f77890a4c557.pdf',
    'b2bcc3fb-a454-4729-9f7a-960625700a4e.pdf'
  ]

  console.log('📋 Arquivos que existem LOCALMENTE mas podem estar faltando no DOCKER:\n')

  for (const path of existingPaths) {
    const file = await prisma.file.findFirst({
      where: { path },
      include: {
        consultation: {
          include: {
            user: { select: { name: true, email: true } },
            professional: { select: { name: true } }
          }
        },
        category: true
      }
    })

    if (file) {
      console.log(`📄 ${file.customName || file.filename}`)
      console.log(`   ID do Arquivo: ${file.id}`)
      console.log(`   Path: ${file.path}`)
      console.log(`   Consulta ID: ${file.consultationId}`)
      console.log(`   Data da Consulta: ${new Date(file.consultation.date).toLocaleDateString('pt-BR')}`)
      console.log(`   Usuário: ${file.consultation.user.name} (${file.consultation.user.email})`)
      console.log(`   Profissional: ${file.consultation.professional?.name || 'N/A'}`)
      console.log(`   Categoria: ${file.category?.name || 'Sem categoria'}`)
      console.log(`   Upload: ${new Date(file.uploadedAt).toLocaleDateString('pt-BR')}`)
      console.log(`   URL Consulta: https://medlog.dalc.in/consultations/${file.consultationId}`)
      console.log(`   URL Arquivo: https://medlog.dalc.in/api/files/${file.path}`)
      console.log('')
    } else {
      console.log(`❌ Arquivo não encontrado no banco: ${path}\n`)
    }
  }

  await prisma.$disconnect()
}

checkExistingFiles()
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
