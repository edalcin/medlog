import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adicionando especialidade padrão aos profissionais sem especialidade...\n')

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
    console.log('✓ Todos os profissionais já têm especialidades associadas!')
    return
  }

  console.log(`Encontrados ${withoutSpecialties.length} profissional(is) sem especialidades.\n`)

  // Get or create "Clínica Geral" specialty
  let defaultSpecialty = await prisma.specialty.findFirst({
    where: {
      name: 'Clínica Geral',
    },
  })

  if (!defaultSpecialty) {
    console.log('Criando especialidade padrão: Clínica Geral')
    defaultSpecialty = await prisma.specialty.create({
      data: {
        name: 'Clínica Geral',
      },
    })
  }

  console.log(`\nAssociando profissionais à especialidade: ${defaultSpecialty.name}\n`)

  for (const prof of withoutSpecialties) {
    console.log(`  - ${prof.name}`)

    await prisma.professionalSpecialty.create({
      data: {
        professionalId: prof.id,
        specialtyId: defaultSpecialty.id,
      },
    })

    console.log(`    ✓ Especialidade associada`)
  }

  console.log('\n✓ Todos os profissionais agora têm especialidades!')
  console.log('\nVocê pode editar os profissionais pela interface para corrigir suas especialidades.')
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
