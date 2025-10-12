import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'
import { ValidationError } from '../../../lib/errors'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return errorResponse('Não autorizado', 401)
    }

    const clinics = await prisma.clinic.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        phones: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            professionals: true,
          },
        },
      },
    })

    return successResponse(clinics)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return errorResponse('Não autorizado', 401)
    }

    const body = await request.json()
    const { name, address } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Nome da clínica é obrigatório')
    }

    // Check if clinic already exists
    const existing = await prisma.clinic.findUnique({
      where: { name: name.trim() },
    })

    if (existing) {
      throw new ValidationError('Já existe uma clínica com este nome')
    }

    const clinic = await prisma.clinic.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
      },
      include: {
        phones: true,
      },
    })

    return successResponse(clinic, 'Clínica criada com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
