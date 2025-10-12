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

    const categories = await prisma.fileCategory.findMany({
      include: {
        _count: {
          select: {
            files: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return successResponse(categories, 'Categorias listadas com sucesso')
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
      throw new ValidationError('Nome da categoria é obrigatório')
    }

    // Check if category already exists
    const existing = await prisma.fileCategory.findFirst({
      where: {
        name: name.trim(),
      },
    })

    if (existing) {
      return successResponse(existing, 'Categoria já existe', 200)
    }

    const category = await prisma.fileCategory.create({
      data: {
        name: name.trim(),
      },
    })

    return successResponse(category, 'Categoria criada com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}
