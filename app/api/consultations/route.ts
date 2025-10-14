import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import {
  successResponse,
  handleApiError,
  errorResponse,
} from '../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const professionalId = searchParams.get('professionalId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')

    // Build where clause
    const where: any = {}

    // ADMIN users see all consultations, regular users only see their own
    if (session.user.role !== 'ADMIN') {
      where.userId = session.user.id
    }

    if (professionalId) {
      where.professionalId = professionalId
    }

    if (type && (type === 'CONSULTATION' || type === 'EVENT')) {
      where.type = type
    }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        where.date.lte = new Date(endDate)
      }
    }

    // Get total count for pagination
    const total = await prisma.consultation.count({ where })

    // Get consultations with pagination
    const consultations = await prisma.consultation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
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
            mimeType: true,
            size: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    // Transform to include specialty names
    const transformedConsultations = consultations.map((consultation) => ({
      ...consultation,
      professional: {
        id: consultation.professional.id,
        name: consultation.professional.name,
        specialties: consultation.professional.specialties.map((ps) => ps.specialty),
      },
    }))

    const result = {
      consultations: transformedConsultations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    return successResponse(result, 'Consultas listadas com sucesso')
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
    const { date, professionalId, proposito, notes, type = 'CONSULTATION' } = body

    // Validate type
    if (type !== 'CONSULTATION' && type !== 'EVENT') {
      throw new ValidationError('Tipo deve ser CONSULTATION ou EVENT')
    }

    // Validate required fields
    if (!date) {
      throw new ValidationError('Data é obrigatória')
    }

    // For consultations, professional is required
    if (type === 'CONSULTATION' && !professionalId) {
      throw new ValidationError('Profissional é obrigatório para consultas')
    }

    // For events, professional must not be provided
    if (type === 'EVENT' && professionalId) {
      throw new ValidationError('Eventos não devem ter profissional associado')
    }

    // Validate date format and ensure it's not in the future
    const consultationDate = new Date(date)
    const now = new Date()
    if (isNaN(consultationDate.getTime())) {
      throw new ValidationError('Data inválida')
    }
    if (consultationDate > now) {
      throw new ValidationError('Data da consulta ou evento não pode ser no futuro')
    }

    // Check if professional exists and is active (only for consultations)
    if (type === 'CONSULTATION') {
      const professional = await prisma.professional.findFirst({
        where: {
          id: professionalId,
          isActive: true,
        },
      })

      if (!professional) {
        throw new NotFoundError('Profissional')
      }
    }

    // Create consultation or event
    const consultation = await prisma.consultation.create({
      data: {
        date: consultationDate,
        proposito: proposito || null,
        notes: notes || null,
        type,
        userId: session.user.id,
        professionalId: type === 'CONSULTATION' ? professionalId : null,
      },
      include: {
        professional: type === 'CONSULTATION' ? {
          select: {
            id: true,
            name: true,
            specialties: {
              include: {
                specialty: true,
              },
            },
          },
        } : undefined,
      },
    })

    // Transform to include specialty names (only if consultation)
    const transformedConsultation = type === 'CONSULTATION' ? {
      ...consultation,
      professional: consultation.professional ? {
        id: consultation.professional.id,
        name: consultation.professional.name,
        specialties: consultation.professional.specialties.map((ps) => ps.specialty),
      } : null,
    } : consultation

    const message = type === 'CONSULTATION'
      ? 'Consulta registrada com sucesso'
      : 'Evento registrado com sucesso'

    return successResponse(
      transformedConsultation,
      message,
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
