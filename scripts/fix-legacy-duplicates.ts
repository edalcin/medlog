import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixLegacyDuplicates() {
  console.log('Fixing legacy duplicate files...\n')

  try {
    // Arquivo 1 (antigo, sem hash)
    const file1Id = await prisma.file
      .findFirst({
        where: { path: '8c8a6579-8e16-4c8f-9b67-499d5ab192b5.pdf' },
        select: { id: true },
      })
      .then(f => f?.id)

    // Arquivo 2 (novo, com hash)
    const file2Id = await prisma.file
      .findFirst({
        where: { path: '43517f79-39f6-4f98-831b-b9f078d5c985.pdf' },
        select: { id: true },
      })
      .then(f => f?.id)

    if (!file1Id || !file2Id) {
      console.log('❌ Arquivos não encontrados')
      return
    }

    // Get the hash from file2
    const file2 = await prisma.file.findUnique({
      where: { id: file2Id },
      select: { hash: true },
    })

    if (!file2?.hash) {
      console.log('❌ Arquivo 2 não tem hash calculado')
      return
    }

    const hash = file2.hash

    console.log('Atualizando arquivo 1 com hash...')
    console.log(`Hash: ${hash}\n`)

    // Update file1 with the hash
    await prisma.file.update({
      where: { id: file1Id },
      data: { hash },
    })

    console.log('✅ Arquivo 1 atualizado com sucesso!')
    console.log(`   Hash: ${hash}`)

    // Now delete the newer duplicate
    console.log('\nDeletando arquivo 2 (duplicate mais novo)...')
    await prisma.file.delete({
      where: { id: file2Id },
    })

    console.log('✅ Arquivo 2 deletado com sucesso!')

    console.log('\n' + '='.repeat(50))
    console.log('Status Final:')
    console.log('='.repeat(50))

    const remaining = await prisma.file.findUnique({
      where: { id: file1Id },
      select: {
        filename: true,
        path: true,
        hash: true,
        uploadedAt: true,
      },
    })

    console.log('✅ Arquivo mantido:')
    console.log(`   Filename: ${remaining?.filename}`)
    console.log(`   Path: ${remaining?.path}`)
    console.log(`   Hash: ${remaining?.hash}`)
    console.log(`   Upload: ${remaining?.uploadedAt}`)

    console.log(
      '\n✅ Próximos uploads duplicados serão detectados corretamente!'
    )
  } catch (error) {
    console.error('❌ Erro:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

fixLegacyDuplicates()
