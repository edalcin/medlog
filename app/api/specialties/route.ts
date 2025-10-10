import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'
import { ValidationError } from '../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const specialties = await prisma.specialty.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    return successResponse(specialties, 'Especialidades listadas com sucesso')
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
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Nome da especialidade é obrigatório')
    }

    // Check if specialty already exists
    const existing = await prisma.specialty.findFirst({
      where: {
        name: name.trim(),
      },
    })

    if (existing) {
      return successResponse(existing, 'Especialidade já existe', 200)
    }

    const specialty = await prisma.specialty.create({
      data: {
        name: name.trim(),
      },
    })

    return successResponse(specialty, 'Especialidade criada com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
