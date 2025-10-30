import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface CategoryPattern {
  keywords: string[]
  categoryName: string
}

async function autoAssignCategories() {
  console.log('='.repeat(70))
  console.log('ATRIBUINDO CATEGORIAS AUTOMATICAMENTE AOS ARQUIVOS')
  console.log('='.repeat(70))
  console.log()

  try {
    // Pattern matching rules for auto-assignment
    const patterns: CategoryPattern[] = [
      { keywords: ['receita'], categoryName: 'Receita' },
      { keywords: ['oculos', 'óculos'], categoryName: 'Receita Óculos' },
      { keywords: ['laudo', 'laudo'], categoryName: 'Laudo' },
      { keywords: ['tomografia', 'tomogr'], categoryName: 'Tomografia' },
      { keywords: ['ressonancia', 'ressonância'], categoryName: 'Ressonância' },
      { keywords: ['ultrassom', 'ultra', 'ultrasonic'], categoryName: 'Ultrassom' },
      { keywords: ['raio', 'rx', 'radiografia'], categoryName: 'Imagem ou Radiografia' },
      { keywords: ['sangue', 'exame de sangue'], categoryName: 'Exame de Sangue' },
      { keywords: ['mapa'], categoryName: 'MAPA' },
      { keywords: ['atestado'], categoryName: 'Atestado' },
      { keywords: ['dieta'], categoryName: 'Dieta' },
      { keywords: ['pedido'], categoryName: 'Pedido de Exame' },
      { keywords: ['encaminha'], categoryName: 'Encaminhamento' },
      { keywords: ['biopsia', 'biópsia'], categoryName: 'Biópsia' },
      { keywords: ['.jpg', '.png'], categoryName: 'Foto' },
    ]

    // Get all categories from database
    const allCategories = await prisma.fileCategory.findMany()
    const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]))

    // Get all files without categories
    const filesWithoutCategories = await prisma.file.findMany({
      where: {
        categories: {
          none: {},
        },
      },
    })

    console.log(`📂 Processando ${filesWithoutCategories.length} arquivo(s) sem categorias...\n`)

    let assigned = 0
    let unassigned = 0
    const assignments: Array<{ filename: string; category: string }> = []

    for (const file of filesWithoutCategories) {
      const filename = (file.customName || file.filename).toLowerCase()
      let foundCategory: string | null = null

      // Try to match against patterns
      for (const pattern of patterns) {
        if (pattern.keywords.some(keyword => filename.includes(keyword))) {
          const category = categoryMap.get(pattern.categoryName.toLowerCase())
          if (category) {
            foundCategory = category.id
            break
          }
        }
      }

      // If found a matching category, assign it
      if (foundCategory) {
        try {
          await prisma.fileFileCategory.create({
            data: {
              fileId: file.id,
              categoryId: foundCategory,
            },
          })
          assigned++
          assignments.push({
            filename: file.customName || file.filename,
            category: categoryMap.get(
              patterns.find(p =>
                p.keywords.some(k => filename.includes(k))
              )?.categoryName.toLowerCase() || ''
            )?.name || 'Desconhecido',
          })
        } catch (err) {
          // Ignore duplicate errors
        }
      } else {
        unassigned++
      }
    }

    console.log(`✅ Categorias atribuídas automaticamente: ${assigned}`)
    console.log(`⏳ Arquivos ainda sem categoria: ${unassigned}`)
    console.log()

    if (assignments.length > 0 && assignments.length <= 20) {
      console.log('📋 Atribuições realizadas:')
      assignments.forEach(a => {
        console.log(`   ✓ ${a.filename} → ${a.category}`)
      })
      console.log()
    }

    // Count current status
    const categorizedCount = await prisma.file.count({
      where: {
        categories: {
          some: {},
        },
      },
    })

    const totalCount = await prisma.file.count()

    console.log('📊 RESUMO FINAL:')
    console.log(`   Total de arquivos: ${totalCount}`)
    console.log(`   Com categorias: ${categorizedCount}`)
    console.log(`   Sem categorias: ${totalCount - categorizedCount}`)
    console.log(`   Percentual categorizado: ${((categorizedCount / totalCount) * 100).toFixed(1)}%`)
    console.log()

    if (unassigned > 0) {
      console.log('⚠️  PRÓXIMOS PASSOS:')
      console.log(`   ${unassigned} arquivo(s) ainda precisam de categorias.`)
      console.log(`   Acesse: http://localhost:3000/admin`)
      console.log(`   Aba "Arquivos" para atribuir manualmente.`)
    } else {
      console.log('✅ Todos os arquivos foram categorizados com sucesso!')
    }
  } catch (error) {
    console.error('❌ Erro:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

autoAssignCategories()
