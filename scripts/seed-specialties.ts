import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const defaultSpecialties = [
  'Cardiologia',
  'Dermatologia',
  'Endocrinologia',
  'Gastroenterologia',
  'Geriatria',
  'Ginecologia',
  'Hematologia',
  'Infectologia',
  'Nefrologia',
  'Neurologia',
  'Nutrição',
  'Obstetrícia',
  'Oftalmologia',
  'Ortopedia',
  'Otorrinolaringologia',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Reumatologia',
  'Urologia',
  'Clínica Geral',
  'Medicina de Família',
  'Anestesiologia',
  'Cirurgia Geral',
  'Fisioterapia',
  'Fonoaudiologia',
  'Odontologia',
  'Psicologia',
]

async function main() {
  console.log('Criando especialidades médicas padrão...')

  for (const specialtyName of defaultSpecialties) {
    const existing = await prisma.specialty.findFirst({
      where: { name: specialtyName },
    })

    if (!existing) {
      await prisma.specialty.create({
        data: { name: specialtyName },
      })
      console.log(`✓ Especialidade criada: ${specialtyName}`)
    } else {
      console.log(`- Especialidade já existe: ${specialtyName}`)
    }
  }

  console.log('\nEspecialidades criadas com sucesso!')
}

main()
  .catch((e) => {
    console.error('Erro ao criar especialidades:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
