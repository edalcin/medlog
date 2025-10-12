import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { successResponse, errorResponse } from '@/lib/responses'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== 'ADMIN') {
    return errorResponse('Acesso negado', 403)
  }

  try {
    const body = await req.json()
    const { ids, isActive } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse('IDs inválidos', 400)
    }

    if (typeof isActive !== 'boolean') {
      return errorResponse('Status inválido', 400)
    }

    // Update professionals
    const result = await prisma.professional.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        isActive,
      },
    })

    return successResponse({
      message: `${result.count} profissional(is) ${isActive ? 'ativado(s)' : 'desativado(s)'} com sucesso`,
      count: result.count,
    })
  } catch (error) {
    console.error('Erro ao atualizar status dos profissionais:', error)
    return errorResponse('Erro ao atualizar status dos profissionais')
  }
}
