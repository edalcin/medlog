import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const professionals = await prisma.professional.findMany({
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        _count: {
          select: {
            consultations: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Transform to include specialty names
    const transformedProfessionals = professionals.map(prof => ({
      ...prof,
      specialties: prof.specialties.map(ps => ps.specialty),
    }))

    return successResponse(transformedProfessionals, 'Profissionais listados com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
