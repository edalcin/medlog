import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../lib/responses'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get total count for pagination
    const total = await prisma.file.count()

    // Get files with pagination
    const files = await prisma.file.findMany({
      include: {
        consultation: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
        category: {
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

    // Transform to include specialty names
    const transformedFiles = files.map(file => ({
      ...file,
      professional: {
        ...file.professional,
        specialties: file.professional.specialties.map(ps => ps.specialty),
      },
    }))

    const result = {
      files: transformedFiles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }

    return successResponse(result, 'Arquivos listados com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
