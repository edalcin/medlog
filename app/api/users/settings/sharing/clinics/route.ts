import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { errorResponse, successResponse } from '@/lib/responses'
import { z } from 'zod'

const updateSharingSchema = z.object({
  userIds: z.array(z.string(), {
    errorMap: () => ({ message: 'userIds deve ser um array de strings' }),
  }),
})

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.json()
    const validatedData = updateSharingSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return errorResponse('Usuário não encontrado', 404)
    }

    // Validate that all provided user IDs exist and are not the current user
    const usersToShareWith = await prisma.user.findMany({
      where: {
        id: {
          in: validatedData.userIds,
        },
      },
      select: {
        id: true,
      },
    })

    if (usersToShareWith.length !== validatedData.userIds.length) {
      return errorResponse('Um ou mais usuários não foram encontrados', 404)
    }

    // Check if trying to share with themselves
    if (validatedData.userIds.includes(session.user.id)) {
      return errorResponse('Não é possível compartilhar consigo mesmo', 400)
    }

    // Delete all existing sharing relationships
    await prisma.userClinicSharing.deleteMany({
      where: {
        sharingFromUserId: session.user.id,
      },
    })

    // Create new sharing relationships
    if (validatedData.userIds.length > 0) {
      await prisma.userClinicSharing.createMany({
        data: validatedData.userIds.map((userId) => ({
          sharingFromUserId: session.user.id,
          sharingToUserId: userId,
        })),
        skipDuplicates: true,
      })
    }

    const updatedSharingList = await prisma.userClinicSharing.findMany({
      where: {
        sharingFromUserId: session.user.id,
      },
      select: {
        sharingToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return successResponse(
      {
        sharingWith: updatedSharingList.map((s) => s.sharingToUser),
      },
      'Compartilhamento de clínicas atualizado com sucesso'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }

    console.error('Error updating clinics sharing:', error)
    return errorResponse('Erro ao atualizar compartilhamento de clínicas', 500)
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const sharingList = await prisma.userClinicSharing.findMany({
      where: {
        sharingFromUserId: session.user.id,
      },
      select: {
        sharingToUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return successResponse({
      sharingWith: sharingList.map((s) => s.sharingToUser),
    })
  } catch (error) {
    console.error('Error fetching clinics sharing:', error)
    return errorResponse('Erro ao buscar compartilhamento de clínicas', 500)
  }
}
