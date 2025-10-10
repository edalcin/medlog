import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const professionals = await prisma.professional.findMany({
      where: {
        isActive: true,
      },
      include: {
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
    const transformedProfessionals = professionals.map(prof => ({
      id: prof.id,
      name: prof.name,
      crm: prof.crm,
      phone: prof.phone,
      specialties: prof.specialties.map(ps => ps.specialty),
    }))

    return successResponse(transformedProfessionals, 'Profissionais ativos listados com sucesso')
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
    const { name, specialtyIds, crm, phone, address } = body

    if (!name || !specialtyIds || specialtyIds.length === 0) {
      throw new ValidationError('Nome e pelo menos uma especialidade são obrigatórios')
    }

    const professional = await prisma.professional.create({
      data: {
        name,
        crm: crm || null,
        phone: phone || null,
        address: address || null,
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
      },
    })

    return successResponse(professional, 'Profissional cadastrado com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}