import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find edalcin user
  const user = await prisma.user.findFirst({
    where: {
      email: {
        contains: 'edalcin'
      }
    }
  })

  if (!user) {
    console.log('Usuário edalcin não encontrado')
    const allUsers = await prisma.user.findMany()
    console.log('Usuários:', allUsers.map(u => ({ email: u.email, name: u.name, role: u.role })))
    return
  }

  console.log('Encontrado usuário:', user.email, 'ID:', user.id, 'Role:', user.role)

  // Count professionals without userId
  const profCount = await prisma.professional.count({
    where: { userId: null }
  })
  console.log('Profissionais sem userId:', profCount)

  // Count clinics without userId
  const clinicCount = await prisma.clinic.count({
    where: { userId: null }
  })
  console.log('Clínicas sem userId:', clinicCount)

  if (user.role === 'USER' && profCount > 0) {
    console.log('Atualizando profissionais para userId:', user.id)
    await prisma.professional.updateMany({
      where: { userId: null },
      data: { userId: user.id }
    })
  }

  if (user.role === 'USER' && clinicCount > 0) {
    console.log('Atualizando clínicas para userId:', user.id)
    await prisma.clinic.updateMany({
      where: { userId: null },
      data: { userId: user.id }
    })
  }

  console.log('Concluído!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
