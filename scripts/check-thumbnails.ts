import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkThumbnails() {
  console.log('🔍 Verificando estado dos thumbnails no banco de dados...\n')

  const files = await prisma.file.findMany({
    select: {
      id: true,
      filename: true,
      mimeType: true,
      thumbnailPath: true,
    },
    take: 20,
  })

  console.log('📋 Amostra de 20 arquivos:')
  files.forEach((f) => {
    const status = f.thumbnailPath ? '✓' : '✗'
    console.log(`  ${status} ${f.filename}: "${f.thumbnailPath}"`)
  })

  const withThumbnail = await prisma.file.count({
    where: { thumbnailPath: { not: null } },
  })

  const totalPDFs = await prisma.file.count({
    where: { mimeType: 'application/pdf' },
  })

  const totalFiles = await prisma.file.count()

  console.log(`\n📊 Estatísticas:`)
  console.log(`  Total de arquivos: ${totalFiles}`)
  console.log(`  Total de PDFs: ${totalPDFs}`)
  console.log(`  PDFs com thumbnail: ${withThumbnail}`)
  console.log(`  Cobertura de thumbnails: ${((withThumbnail / totalPDFs) * 100).toFixed(1)}%`)

  // Check which PDFs are missing thumbnails
  const pdfsMissingThumbnail = await prisma.file.findMany({
    where: {
      mimeType: 'application/pdf',
      thumbnailPath: null,
    },
    select: {
      id: true,
      filename: true,
    },
  })

  if (pdfsMissingThumbnail.length > 0) {
    console.log(`\n⚠️  PDFs sem thumbnail (${pdfsMissingThumbnail.length}):`)
    pdfsMissingThumbnail.slice(0, 10).forEach((f) => {
      console.log(`  - ${f.filename} (${f.id})`)
    })
  }

  await prisma.$disconnect()
}

checkThumbnails()
