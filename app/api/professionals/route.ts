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
        crm: true,
        phone: true,
        specialties: {
          include: {
            specialty: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform to include specialty names
    const transformedProfessionals = professionals.map((professional) => ({
      ...professional,
      specialties: professional.specialties.map((ps) => ps.specialty),
    }))

    if (transformedProfessionals.length === 0) {
      throw new NotFoundError('Profissionais')
    }

    return successResponse(
      transformedProfessionals,
      'Profissionais ativos listados com sucesso'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
