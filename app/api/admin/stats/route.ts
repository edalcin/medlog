import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 403)
    }

    const userCount = await prisma.user.count()
    const professionalCount = await prisma.professional.count()
    const consultationCount = await prisma.consultation.count()

    const stats = {
      users: userCount,
      professionals: professionalCount,
      consultations: consultationCount,
    }

    return successResponse(stats, 'Estatísticas carregadas com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
