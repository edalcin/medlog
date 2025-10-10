import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Migrando especialidades de profissionais existentes...')

  // Get all professionals
  const professionals = await prisma.$queryRaw<Array<{ id: string; name: string; specialty: string | null }>>`
    SELECT id, name, specialty FROM professionals WHERE specialty IS NOT NULL
  `

  if (professionals.length === 0) {
    console.log('Nenhum profissional com especialidade antiga encontrado.')
    return
  }

  for (const professional of professionals) {
    if (!professional.specialty) continue

    console.log(`\nProcessando: ${professional.name} (${professional.specialty})`)

    // Check if specialty exists
    let specialty = await prisma.specialty.findFirst({
      where: {
        name: {
          equals: professional.specialty.trim(),
          mode: 'insensitive',
        },
      },
    })

    // Create if doesn't exist
    if (!specialty) {
      console.log(`  Criando especialidade: ${professional.specialty}`)
      specialty = await prisma.specialty.create({
        data: {
          name: professional.specialty.trim(),
        },
      })
    }

    // Check if association already exists
    const existing = await prisma.professionalSpecialty.findFirst({
      where: {
        professionalId: professional.id,
        specialtyId: specialty.id,
      },
    })

    if (!existing) {
      console.log(`  Associando especialidade ao profissional...`)
      await prisma.professionalSpecialty.create({
        data: {
          professionalId: professional.id,
          specialtyId: specialty.id,
        },
      })
      console.log(`  ✓ Especialidade associada com sucesso`)
    } else {
      console.log(`  - Associação já existe`)
    }
  }

  console.log('\n✓ Migração concluída com sucesso!')
  console.log('\nVocê pode agora remover a coluna "specialty" da tabela "professionals" se desejar.')
}

main()
  .catch((e) => {
    console.error('Erro durante migração:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
