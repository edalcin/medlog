import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { errorResponse, successResponse } from '@/lib/responses'
import { compare, hash } from 'bcryptjs'
import { z } from 'zod'

const updatePersonalDataSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  email: z.string().email('Email inválido').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').optional(),
})

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()
    const validatedData = updatePersonalDataSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    // If changing password, validate current password
    if (validatedData.newPassword) {
      if (!validatedData.currentPassword) {
        return errorResponse('Senha atual é obrigatória para mudar a senha', 400)
      }

      const passwordMatch = await compare(validatedData.currentPassword, user.passwordHash)
      if (!passwordMatch) {
        return errorResponse('Senha atual incorreta', 401)
      }
    }

    // If changing email, check if it's already taken
    if (validatedData.email && validatedData.email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      })

      if (existingUser) {
        return errorResponse('Email já está em uso', 409)
      }
    }

    const updateData: any = {}

    if (validatedData.name) {
      updateData.name = validatedData.name
    }

    if (validatedData.email) {
      updateData.email = validatedData.email
    }

    if (validatedData.newPassword) {
      updateData.passwordHash = await hash(validatedData.newPassword, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    return successResponse(updatedUser, 'Dados pessoais atualizados com sucesso')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }

    console.error('Error updating user settings:', error)
    return errorResponse('Erro ao atualizar dados pessoais', 500)
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        theme: true,
      },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    return successResponse(user)
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return errorResponse('Erro ao buscar configurações', 500)
  }
}
