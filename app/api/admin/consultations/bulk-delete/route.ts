import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../../lib/responses'
import { ValidationError } from '../../../../../lib/errors'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('IDs são obrigatórios')
    }

    // Delete consultations (files will be cascade deleted)
    const result = await prisma.consultation.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    })

    return successResponse(
      { deletedCount: result.count },
      `${result.count} consulta(s) excluída(s) com sucesso`
    )
  } catch (error) {
    return handleApiError(error)
  }
}
