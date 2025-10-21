import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const whereClause: any = {}

    // ADMIN users see all files, regular users only see their own
    if (session.user.role !== 'ADMIN') {
      whereClause.userId = session.user.id
    }

    // Get total count for pagination
    const total = await prisma.file.count({
      where: whereClause,
    })

    // Get files with associations
    const files = await prisma.file.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        consultation: {
          select: {
            id: true,
            date: true,
            proposito: true,
            professional: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    const result = {
      data: files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    return successResponse(result.data, 'Arquivos listados com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
