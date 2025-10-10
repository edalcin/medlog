import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Verificando profissionais sem especialidades...\n')

  // Get all professionals with their specialties
  const professionals = await prisma.professional.findMany({
    include: {
      specialties: {
        include: {
          specialty: true,
        },
      },
    },
  })

  const withoutSpecialties = professionals.filter(p => p.specialties.length === 0)

  if (withoutSpecialties.length === 0) {
    console.log('✓ Todos os profissionais têm especialidades associadas!')

    console.log('\nProfissionais cadastrados:')
    professionals.forEach(prof => {
      const specs = prof.specialties.map(ps => ps.specialty.name).join(', ')
      console.log(`  - ${prof.name}: ${specs}`)
    })
  } else {
    console.log(`⚠ Encontrados ${withoutSpecialties.length} profissional(is) sem especialidades:\n`)

    withoutSpecialties.forEach(prof => {
      console.log(`  - ID: ${prof.id}`)
      console.log(`    Nome: ${prof.name}`)
      console.log(`    CRM: ${prof.crm || 'N/A'}`)
      console.log(`    Ativo: ${prof.isActive ? 'Sim' : 'Não'}`)
      console.log()
    })

    console.log('\nPara corrigir, você pode:')
    console.log('1. Editar esses profissionais pela interface e adicionar especialidades')
    console.log('2. Ou executar o script de seed para criar especialidades padrão:')
    console.log('   npm run seed:specialties')
  }
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
