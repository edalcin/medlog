import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting phone migration...')

  // Migrar telefones de profissionais
  const professionals = await prisma.professional.findMany({
    where: {
      phone: {
        not: null,
      },
    },
  })

  console.log(`Found ${professionals.length} professionals with phones`)

  for (const professional of professionals) {
    if (professional.phone) {
      await prisma.$executeRaw`
        INSERT INTO phones (id, number, professionalId, createdAt)
        VALUES (UUID(), ${professional.phone}, ${professional.id}, NOW())
      `
      console.log(`Migrated phone for professional: ${professional.name}`)
    }
  }

  // Migrar telefones de clínicas
  const clinics = await prisma.$queryRaw<Array<{ id: string; name: string; phone: string }>>`
    SELECT id, name, phone FROM clinics WHERE phone IS NOT NULL
  `

  console.log(`Found ${clinics.length} clinics with phones`)

  for (const clinic of clinics) {
    if (clinic.phone) {
      await prisma.$executeRaw`
        INSERT INTO phones (id, number, clinicId, createdAt)
        VALUES (UUID(), ${clinic.phone}, ${clinic.id}, NOW())
      `
      console.log(`Migrated phone for clinic: ${clinic.name}`)
    }
  }

  console.log('Phone migration completed!')
}

main()
  .catch((e) => {
    console.error('Error during migration:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
