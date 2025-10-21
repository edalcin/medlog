import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../../lib/errors'

const prisma = new PrismaClient()

export async function POST(
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
    const { number, label } = body

    if (!number || typeof number !== 'string' || number.trim().length === 0) {
      throw new ValidationError('Número de telefone é obrigatório')
    }

    // Build where clause: if not admin, filter by userId
    const professionalWhereClause = session.user.role === 'ADMIN'
      ? { id }
      : { id, userId: session.user.id }

    // Verify professional exists and user has access
    const professional = await prisma.professional.findUnique({
      where: professionalWhereClause as any,
    })

    if (!professional) {
      throw new NotFoundError('Profissional')
    }

    const phone = await prisma.phone.create({
      data: {
        number: number.trim(),
        label: label?.trim() || null,
        professionalId: id,
      },
    })

    return successResponse(phone, 'Telefone adicionado com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
