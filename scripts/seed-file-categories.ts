import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultCategories = [
  'Laudo',
  'Receita',
  'Pedido de Exame',
  'Resultado de Exame',
  'Atestado',
  'Relatório Médico',
  'Guia de Consulta',
  'Outros',
]

async function main() {
  console.log('Criando categorias padrão de arquivos...')

  for (const categoryName of defaultCategories) {
    const existing = await prisma.fileCategory.findFirst({
      where: { name: categoryName },
    })

    if (!existing) {
      await prisma.fileCategory.create({
        data: { name: categoryName },
      })
      console.log(`✓ Categoria criada: ${categoryName}`)
    } else {
      console.log(`- Categoria já existe: ${categoryName}`)
    }
  }

  console.log('\nCategorias criadas com sucesso!')
}

main()
  .catch((e) => {
    console.error('Erro ao criar categorias:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
