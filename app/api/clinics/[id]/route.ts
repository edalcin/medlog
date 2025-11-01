import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../lib/errors'

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

    const { id } = params

    // Build where clause: if not admin, include clínicas criadas pelo usuário ou compartilhadas
    const whereClause = session.user.role === 'ADMIN'
      ? { id }
      : {
          AND: [
            { id },
            {
              OR: [
                { userId: session.user.id },  // clínicas que ele criou
                {
                  user: {
                    clinicsSharingFrom: {
                      some: { sharingToUserId: session.user.id },  // clínicas compartilhadas com ele
                    },
                  },
                },
              ],
            },
          ],
        }

    const clinic = await prisma.clinic.findFirst({
      where: whereClause as any,
      include: {
        user: {
          select: {
            id: true,
          },
        },
        phones: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!clinic) {
      throw new NotFoundError('Clínica')
    }

    // Check if user can edit this clinic
    const transformedClinic = {
      ...clinic,
      canEdit: clinic.userId === session.user.id || session.user.role === 'ADMIN',
    }

    return successResponse(transformedClinic, 'Clínica encontrada com sucesso')
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

    const { id } = params
    const body = await request.json()
    const { name, address } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Nome da clínica é obrigatório')
    }

    // Build where clause: if not admin, filter by userId
    const whereClause = session.user.role === 'ADMIN'
      ? { id }
      : { id, userId: session.user.id }

    // Check if clinic exists
    const existing = await prisma.clinic.findUnique({
      where: whereClause as any,
    })

    if (!existing) {
      throw new NotFoundError('Clínica')
    }

    // Check if another clinic with same name exists (respect user isolation for non-admins)
    const duplicateWhere = session.user.role === 'ADMIN'
      ? { name: name.trim(), NOT: { id } }
      : { name: name.trim(), NOT: { id }, userId: session.user.id }

    const duplicate = await prisma.clinic.findFirst({
      where: duplicateWhere,
    })

    if (duplicate) {
      throw new ValidationError('Já existe uma clínica com este nome')
    }

    const clinic = await prisma.clinic.update({
      where: { id },
      data: {
        name: name.trim(),
        address: address?.trim() || null,
      },
      include: {
        phones: true,
      },
    })

    return successResponse(clinic, 'Clínica atualizada com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params

    // Build where clause: if not admin, filter by userId
    const clinicWhereClause = session.user.role === 'ADMIN'
      ? { id }
      : { id, userId: session.user.id }

    // Check if clinic exists and user has access
    const clinic = await prisma.clinic.findUnique({
      where: clinicWhereClause as any,
    })

    if (!clinic) {
      throw new NotFoundError('Clínica')
    }

    // Check if clinic is in use
    const inUse = await prisma.professional.findFirst({
      where: { clinicId: id },
      select: { name: true },
    })

    if (inUse) {
      return errorResponse(
        `Esta clínica não pode ser excluída pois está associada ao profissional: ${inUse.name}`,
        400
      )
    }

    await prisma.clinic.delete({
      where: { id },
    })

    return successResponse(null, 'Clínica excluída com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
