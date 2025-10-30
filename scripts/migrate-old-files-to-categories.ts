import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateOldFilesToCategories() {
  console.log('='.repeat(70))
  console.log('MIGRANDO ARQUIVOS ANTIGOS PARA NOVO SISTEMA DE CATEGORIAS')
  console.log('='.repeat(70))
  console.log()

  try {
    // Get all files without categories
    const filesWithoutCategories = await prisma.file.findMany({
      where: {
        categories: {
          none: {},
        },
      },
      include: {
        consultation: {
          select: {
            id: true,
            date: true,
            user: { select: { name: true } },
          },
        },
      },
    })

    if (filesWithoutCategories.length === 0) {
      console.log('✅ Todos os arquivos já têm categorias associadas!')
      console.log()
      await prisma.$disconnect()
      return
    }

    console.log(`⚠️  Encontrados ${filesWithoutCategories.length} arquivo(s) sem categorias associadas:\n`)

    filesWithoutCategories.forEach((file, idx) => {
      console.log(`${idx + 1}. ${file.customName || file.filename}`)
      console.log(`   ID: ${file.id}`)
      console.log(`   Data de Upload: ${new Date(file.uploadedAt).toLocaleDateString('pt-BR')}`)
      if (file.consultation) {
        console.log(`   Consulta: ${new Date(file.consultation.date).toLocaleDateString('pt-BR')} (${file.consultation.user.name})`)
      }
      console.log()
    })

    console.log('Estes arquivos precisam de categorias associadas.')
    console.log()
    console.log('Opções:')
    console.log('1. Usar categorias predefinidas (ex: "Laudo", "Receita")')
    console.log('2. Atribuir manualmente através da interface web')
    console.log('3. Deixar sem categoria por enquanto')
    console.log()

    // Get existing categories
    const categories = await prisma.fileCategory.findMany()
    if (categories.length > 0) {
      console.log('📂 Categorias disponíveis:')
      categories.forEach((cat, idx) => {
        console.log(`   ${idx + 1}. ${cat.name}`)
      })
      console.log()
    }

    console.log('PRÓXIMOS PASSOS:')
    console.log('1. Acesse a interface admin em http://localhost:3000/admin')
    console.log('2. Vá até a aba "Arquivos"')
    console.log('3. Clique nos arquivos listados acima e atribua categorias manualmente')
    console.log('   OU execute um comando como:')
    console.log()
    console.log('   // Para atribuir "Laudo" a um arquivo:')
    console.log(`   await prisma.fileFileCategory.create({`)
    console.log(`     data: {`)
    console.log(`       fileId: "<FILE_ID>",`)
    console.log(`       categoryId: "<CATEGORY_ID>"`)
    console.log(`     }`)
    console.log(`   })`)
    console.log()

    // Count files by status
    const totalFiles = await prisma.file.count()
    const filesWithCategories = await prisma.file.findMany({
      where: {
        categories: {
          some: {},
        },
      },
      select: { id: true },
    })

    console.log('📊 RESUMO:')
    console.log(`   Total de arquivos: ${totalFiles}`)
    console.log(`   Com categorias: ${filesWithCategories.length}`)
    console.log(`   Sem categorias: ${filesWithoutCategories.length}`)
    console.log(`   Percentual categorizado: ${((filesWithCategories.length / totalFiles) * 100).toFixed(1)}%`)
    console.log()

    if (filesWithCategories.length === totalFiles) {
      console.log('✅ Sistema de categorias está 100% migrado!')
    } else {
      console.log('⏳ Concluir categorização dos arquivos restantes para melhor organização.')
    }
  } catch (error) {
    console.error('❌ Erro:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

migrateOldFilesToCategories()
