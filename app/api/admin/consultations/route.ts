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

    const consultations = await prisma.consultation.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        },
        files: {
          select: {
            id: true,
            filename: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })

    // Transform to include specialty names
    const transformedConsultations = consultations.map(consultation => ({
      ...consultation,
      professional: consultation.professional ? {
        id: consultation.professional.id,
        name: consultation.professional.name,
        specialties: consultation.professional.specialties.map(ps => ps.specialty),
      } : null,
    }))

    return successResponse(transformedConsultations, 'Consultas listadas com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
