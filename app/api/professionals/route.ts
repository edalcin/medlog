import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'
import { NotFoundError, ValidationError } from '../../../lib/errors'

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const body = await request.json()
    const { name, crm, phone, address, specialtyIds, clinicId } = body

    if (!name) {
      throw new ValidationError('Nome é obrigatório')
    }

    if (!specialtyIds || !Array.isArray(specialtyIds) || specialtyIds.length === 0) {
      throw new ValidationError('Selecione pelo menos uma especialidade')
    }

    // Create professional with specialties
    const professional = await prisma.professional.create({
      data: {
        name,
        crm: crm || null,
        phone: phone || null,
        address: address || null,
        clinicId: clinicId || null,
        specialties: {
          create: specialtyIds.map((specialtyId: string) => ({
            specialtyId,
          })),
        },
      },
      include: {
        specialties: {
          include: {
            specialty: true,
          },
        },
        clinic: true,
      },
    })

    // Transform to include specialty names
    const transformedProfessional = {
      ...professional,
      specialties: professional.specialties.map((ps) => ps.specialty),
    }

    return successResponse(
      transformedProfessional,
      'Profissional criado com sucesso',
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
