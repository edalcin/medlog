import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { successResponse, handleApiError } from '../../../lib/responses'
import { NotFoundError } from '../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const professionals = await prisma.professional.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        crm: true,
        phone: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    if (professionals.length === 0) {
      throw new NotFoundError('Profissionais')
    }

    return successResponse(professionals, 'Profissionais ativos listados com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}