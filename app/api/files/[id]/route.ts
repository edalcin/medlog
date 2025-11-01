import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { NotFoundError, ForbiddenError } from '../../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const fileId = params.id

    // Find file with all associations
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consultation: {
          select: {
            id: true,
            date: true,
            proposito: true,
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // Check if user owns the file or is admin
    if (file.userId !== session.user.id && session.user.role !== 'ADMIN') {
      throw new ForbiddenError('Você não tem permissão para acessar este arquivo')
    }

    return successResponse(file, 'Arquivo carregado com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const fileId = params.id
    const body = await request.json()
    const { customName, professionalId } = body

    // Find file and check ownership
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        consultation: {
          select: {
            id: true,
            professionalId: true,
          },
        },
      },
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // Check if user owns the file or is admin
    if (file.userId !== session.user.id && session.user.role !== 'ADMIN') {
      throw new ForbiddenError('Você não tem permissão para editar este arquivo')
    }

    // Verify professional exists if provided (and user has access)
    if (professionalId) {
      const professionalWhere = session.user.role === 'ADMIN'
        ? { id: professionalId }
        : {
            AND: [
              { id: professionalId },
              {
                OR: [
                  { userId: session.user.id },  // profissionais que ele criou
                  {
                    user: {
                      professionalsSharingFrom: {
                        some: { sharingToUserId: session.user.id },  // profissionais compartilhados com ele
                      },
                    },
                  },
                ],
              },
            ],
          }

      const professional = await prisma.professional.findFirst({
        where: professionalWhere,
      })

      if (!professional) {
        return errorResponse('Profissional não encontrado', 404)
      }
    }

    // Update file
    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        customName: customName || null,
        professionalId: professionalId || file.consultation?.professionalId || null,
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        consultation: {
          select: {
            id: true,
            date: true,
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return successResponse(updatedFile, 'Arquivo atualizado com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
