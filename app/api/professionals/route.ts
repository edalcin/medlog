import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'
import { NotFoundError, ValidationError } from '../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') // 'active', 'inactive', 'all'

    // Build where clause based on filter
    const whereClause: any = {}
    if (statusFilter === 'active') {
      whereClause.isActive = true
    } else if (statusFilter === 'inactive') {
      whereClause.isActive = false
    }
    // If 'all' or no filter, don't add isActive filter

    const professionals = await prisma.professional.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        crm: true,
        phone: true,
        isActive: true,
        specialties: {
          include: {
            specialty: true,
          },
        },
        _count: {
          select: {
            consultations: true,
            files: true,
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
      'Profissionais listados com sucesso'
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
    const { name, crm, phone, address, notes, specialtyIds, clinicId } = body

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
        notes: notes || null,
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
