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
    const search = searchParams.get('search') || ''
    const consultationId = searchParams.get('consultationId')

    // Build where clause
    const where: any = {}

    // If user is not admin, filter by userId
    if (session.user.role !== 'ADMIN') {
      where.userId = session.user.id
    }

    const andConditions: any[] = []

    // If search is provided, search by customName or filename
    if (search) {
      andConditions.push({
        OR: [
          { customName: { contains: search } },
          { filename: { contains: search } },
        ],
      })
    }

    // Exclude files already associated with the current consultation
    // Note: { not: x } in SQL doesn't match NULLs, so we must explicitly include them
    if (consultationId) {
      andConditions.push({
        OR: [{ consultationId: null }, { consultationId: { not: consultationId } }],
      })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    // Get files
    const files = await prisma.file.findMany({
      where,
      include: {
        categories: {
          include: {
            category: {
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
        consultation: {
          select: {
            id: true,
            date: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
      take: 100, // Limit to 100 results
    })

    return successResponse(files, 'Arquivos disponíveis listados com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
