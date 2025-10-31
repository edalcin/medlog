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
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params
    const body = await request.json()
    const { customName, consultationId, categoryIds, professionalId } = body

    // Build where clause: if not admin, filter by userId
    const fileWhereClause = session.user.role === 'ADMIN'
      ? { id }
      : { id, userId: session.user.id }

    // Verify file exists and user has access
    const file = await prisma.file.findUnique({
      where: fileWhereClause as any,
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // If consultationId is being changed, verify the consultation exists and user has access
    if (consultationId && consultationId !== file.consultationId) {
      const consultationWhereClause = session.user.role === 'ADMIN'
        ? { id: consultationId }
        : { id: consultationId, userId: session.user.id }

      const consultation = await prisma.consultation.findUnique({
        where: consultationWhereClause as any,
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
          professionalId: professionalId || consultation.professionalId,
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
        },
      })

      // Handle category updates if provided
      if (categoryIds && categoryIds.length >= 0) {
        // Remove all existing category associations
        await prisma.fileFileCategory.deleteMany({
          where: { fileId: id },
        })

        // Add new category associations
        if (categoryIds.length > 0) {
          for (const catId of categoryIds) {
            await prisma.fileFileCategory.create({
              data: {
                fileId: id,
                categoryId: catId,
              },
            }).catch(() => {
              // Ignore duplicate associations
            })
          }
        }
      }

      return successResponse(updatedFile, 'Arquivo atualizado com sucesso')
    }

    // If only updating customName, categories, or professional
    const updatedFile = await prisma.file.update({
      where: { id },
      data: {
        customName: customName || null,
        professionalId: professionalId || file.professionalId || null,
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
      },
    })

    // Handle category updates if provided
    if (categoryIds && categoryIds.length >= 0) {
      // Remove all existing category associations
      await prisma.fileFileCategory.deleteMany({
        where: { fileId: id },
      })

      // Add new category associations
      if (categoryIds.length > 0) {
        for (const catId of categoryIds) {
          await prisma.fileFileCategory.create({
            data: {
              fileId: id,
              categoryId: catId,
            },
          }).catch(() => {
            // Ignore duplicate associations
          })
        }
      }
    }

    return successResponse(updatedFile, 'Arquivo atualizado com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
