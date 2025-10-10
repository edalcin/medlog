import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../lib/errors'

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
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Nome da especialidade é obrigatório')
    }

    // Check if specialty exists
    const existing = await prisma.specialty.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new NotFoundError('Especialidade')
    }

    // Check if another specialty with same name exists
    const duplicate = await prisma.specialty.findFirst({
      where: {
        name: name.trim(),
        NOT: { id },
      },
    })

    if (duplicate) {
      throw new ValidationError('Já existe uma especialidade com este nome')
    }

    const specialty = await prisma.specialty.update({
      where: { id },
      data: {
        name: name.trim(),
      },
    })

    return successResponse(specialty, 'Especialidade atualizada com sucesso')
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
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params

    // Check if specialty is in use
    const inUse = await prisma.professionalSpecialty.findFirst({
      where: { specialtyId: id },
      include: {
        professional: {
          select: { name: true },
        },
      },
    })

    if (inUse) {
      return errorResponse(
        `Esta especialidade não pode ser excluída pois está associada ao profissional: ${inUse.professional.name}`,
        400
      )
    }

    await prisma.specialty.delete({
      where: { id },
    })

    return successResponse(null, 'Especialidade excluída com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
