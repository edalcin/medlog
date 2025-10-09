import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { NotFoundError } from '../../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const consultation = await prisma.consultation.findUnique({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      include: {
        professional: true,
        files: true,
      },
    })

    if (!consultation) {
      throw new NotFoundError('Consulta')
    }

    return successResponse(consultation, 'Consulta encontrada com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
