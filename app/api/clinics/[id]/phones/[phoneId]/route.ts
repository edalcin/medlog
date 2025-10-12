import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../../../lib/errors'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; phoneId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return errorResponse('Não autorizado', 401)
    }

    const { phoneId } = params
    const body = await request.json()
    const { number, label } = body

    if (!number || typeof number !== 'string' || number.trim().length === 0) {
      throw new ValidationError('Número de telefone é obrigatório')
    }

    const phone = await prisma.phone.update({
      where: { id: phoneId },
      data: {
        number: number.trim(),
        label: label?.trim() || null,
      },
    })

    return successResponse(phone, 'Telefone atualizado com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; phoneId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return errorResponse('Não autorizado', 401)
    }

    const { phoneId } = params

    await prisma.phone.delete({
      where: { id: phoneId },
    })

    return successResponse(null, 'Telefone excluído com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
