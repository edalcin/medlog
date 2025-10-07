import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '@/lib/responses'
import { ValidationError, NotFoundError } from '@/lib/errors'

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

    // Build where clause
    const where: any = {
      userId: session.user.id,
    }

    if (professionalId) {
      where.professionalId = professionalId
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
        professional: {
          select: {
            id: true,
            name: true,
            specialty: true,
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

    const result = {
      consultations,
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
    const { date, professionalId, notes } = body

    // Validate required fields
    if (!date || !professionalId) {
      throw new ValidationError('Data e profissional são obrigatórios')
    }

    // Validate date format and ensure it's not in the future
    const consultationDate = new Date(date)
    const now = new Date()
    if (isNaN(consultationDate.getTime())) {
      throw new ValidationError('Data inválida')
    }
    if (consultationDate > now) {
      throw new ValidationError('Data da consulta não pode ser no futuro')
    }

    // Check if professional exists and is active
    const professional = await prisma.professional.findFirst({
      where: {
        id: professionalId,
        isActive: true,
      },
    })

    if (!professional) {
      throw new NotFoundError('Profissional')
    }

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        date: consultationDate,
        notes: notes || null,
        userId: session.user.id,
        professionalId,
      },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
      },
    })

    return successResponse(consultation, 'Consulta registrada com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}