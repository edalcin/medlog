import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { errorResponse, successResponse } from '@/lib/responses'
import { z } from 'zod'

const updateThemeSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM'], {
    errorMap: () => ({ message: 'Tema deve ser LIGHT, DARK ou SYSTEM' }),
  }),
})

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()
    const validatedData = updateThemeSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        theme: validatedData.theme as any,
      },
      select: {
        id: true,
        theme: true,
      },
    })

    return successResponse(updatedUser, 'Tema atualizado com sucesso')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }

    console.error('Error updating theme:', error)
    return errorResponse('Erro ao atualizar tema', 500)
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
        theme: true,
      },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    return successResponse(user)
  } catch (error) {
    console.error('Error fetching theme:', error)
    return errorResponse('Erro ao buscar tema', 500)
  }
}
