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

    return successResponse(professionals, 'Profissionais ativos listados com sucesso')
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
    const { name, specialty, crm, phone, address } = body

    if (!name || !specialty) {
      throw new ValidationError('Nome e especialidade são obrigatórios')
    }

    const professional = await prisma.professional.create({
      data: {
        name,
        specialty,
        crm: crm || null,
        phone: phone || null,
        address: address || null,
      },
    })

    return successResponse(professional, 'Profissional cadastrado com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}