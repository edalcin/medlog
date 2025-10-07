#!/usr/bin/env ts-node
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com'
  const password = process.env.ADMIN_PASSWORD || 'change_me_now'
  const name = 'Administrador'
  const hash = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Usuário admin já existe:', email)
    return
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hash,
      role: 'ADMIN'
    }
  })
  console.log('Usuário admin criado com sucesso:')
  console.log('Email:', email)
  console.log('Senha:', password)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
