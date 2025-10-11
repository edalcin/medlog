import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import {
  successResponse,
  handleApiError,
  errorResponse,
} from '../../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../../lib/errors'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params
    const body = await request.json()
    const { customName, consultationId, categoryId } = body

    // Verify file exists
    const file = await prisma.file.findUnique({
      where: { id },
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // If consultationId is being changed, verify the consultation exists
    if (consultationId && consultationId !== file.consultationId) {
      const consultation = await prisma.consultation.findUnique({
        where: { id: consultationId },
        include: {
          professional: true,
        },
      })

      if (!consultation) {
        throw new NotFoundError('Consulta')
      }

      // Update file with new consultation and professional
      const updatedFile = await prisma.file.update({
        where: { id },
        data: {
          customName: customName || null,
          consultationId,
          professionalId: consultation.professionalId,
          categoryId: categoryId || null,
        },
        include: {
          consultation: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          professional: {
            select: {
              id: true,
              name: true,
              specialties: {
                include: {
                  specialty: true,
                },
              },
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return successResponse(updatedFile, 'Arquivo atualizado com sucesso')
    }

    // If only updating customName or categoryId
    const updatedFile = await prisma.file.update({
      where: { id },
      data: {
        customName: customName || null,
        categoryId: categoryId || null,
      },
      include: {
        consultation: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        },
        category: {
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
