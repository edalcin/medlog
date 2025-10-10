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

    // Check if any professional has consultations
    const professionalsWithConsultations = await prisma.professional.findMany({
      where: {
        id: {
          in: ids,
        },
        consultations: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            consultations: true,
          },
        },
      },
    })

    if (professionalsWithConsultations.length > 0) {
      const names = professionalsWithConsultations.map(p => `${p.name} (${p._count.consultations} consultas)`).join(', ')
      return errorResponse(
        `Não é possível excluir profissionais com consultas associadas: ${names}`,
        400
      )
    }

    // Delete professionals
    const result = await prisma.professional.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    })

    return successResponse(
      { deletedCount: result.count },
      `${result.count} profissional(is) excluído(s) com sucesso`
    )
  } catch (error) {
    return handleApiError(error)
  }
}
