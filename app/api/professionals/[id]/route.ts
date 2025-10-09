import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { NotFoundError, ValidationError } from '../../../../lib/errors'

const prisma = new PrismaClient()

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const professional = await prisma.professional.findUnique({
      where: {
        id: params.id,
      },
    })

    if (!professional) {
      throw new NotFoundError('Profissional')
    }

    return successResponse(professional, 'Profissional encontrado com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.role !== 'ADMIN') {
            return errorResponse('Não autorizado', 403)
        }

        const body = await request.json()
        const { name, specialty, crm, phone, address, isActive } = body

        if (!name || !specialty) {
            throw new ValidationError('Nome e especialidade são obrigatórios')
        }

        const professional = await prisma.professional.update({
            where: { id: params.id },
            data: {
                name,
                specialty,
                crm,
                phone,
                address,
                isActive,
            },
        })

        return successResponse(professional, 'Profissional atualizado com sucesso')
    } catch (error) {
        return handleApiError(error)
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (session?.user?.role !== 'ADMIN') {
            return errorResponse('Não autorizado', 403)
        }

        await prisma.professional.delete({
            where: { id: params.id },
        })

        return successResponse({}, 'Profissional removido com sucesso')
    } catch (error) {
        return handleApiError(error)
    }
}
