import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { errorResponse, successResponse } from '@/lib/responses'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.id) {
      return errorResponse('Unauthorized', 401)
    }

    const allUsers = await prisma.user.findMany({
      where: {
        id: {
          not: session.user.id, // Exclude current user
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return successResponse(allUsers)
  } catch (error) {
    console.error('Error fetching all users:', error)
    return errorResponse('Erro ao buscar usuários', 500)
  }
}
