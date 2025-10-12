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
    if (!session) {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params
    const body = await request.json()
    const { name, address } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Nome da clínica é obrigatório')
    }

    // Check if clinic exists
    const existing = await prisma.clinic.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new NotFoundError('Clínica')
    }

    // Check if another clinic with same name exists
    const duplicate = await prisma.clinic.findFirst({
      where: {
        name: name.trim(),
        NOT: { id },
      },
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
    if (!session) {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params

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
