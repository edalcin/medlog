import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultClinics = [
  'Hospital Particular',
  'Hospital Público',
  'Clínica Particular',
  'UBS - Unidade Básica de Saúde',
  'UPA - Unidade de Pronto Atendimento',
  'Consultório Particular',
  'Ambulatório',
  'Pronto Socorro',
]

async function main() {
  console.log('Seeding clinics...')

  for (const clinicName of defaultClinics) {
    const existing = await prisma.clinic.findUnique({
      where: { name: clinicName },
    })

    if (!existing) {
      await prisma.clinic.create({
        data: { name: clinicName },
      })
      console.log(`✓ Created clinic: ${clinicName}`)
    } else {
      console.log(`→ Clinic already exists: ${clinicName}`)
    }
  }

  console.log('\nClinics seeding completed!')
  console.log(`Total clinics in database: ${await prisma.clinic.count()}`)
}

main()
  .catch((e) => {
    console.error('Error seeding clinics:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
