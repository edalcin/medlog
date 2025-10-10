import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../lib/errors'

const prisma = new PrismaClient()

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Nome da categoria é obrigatório')
    }

    // Check if category exists
    const existing = await prisma.fileCategory.findUnique({
      where: { id },
    })

    if (!existing) {
      throw new NotFoundError('Categoria')
    }

    // Check if another category with same name exists
    const duplicate = await prisma.fileCategory.findFirst({
      where: {
        name: name.trim(),
        NOT: { id },
      },
    })

    if (duplicate) {
      throw new ValidationError('Já existe uma categoria com este nome')
    }

    const category = await prisma.fileCategory.update({
      where: { id },
      data: {
        name: name.trim(),
      },
    })

    return successResponse(category, 'Categoria atualizada com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const { id } = params

    // Check if category is in use
    const inUse = await prisma.file.findFirst({
      where: { categoryId: id },
      include: {
        consultation: {
          select: {
            user: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (inUse) {
      return errorResponse(
        `Esta categoria não pode ser excluída pois está associada a arquivos do usuário: ${inUse.consultation.user.name}`,
        400
      )
    }

    await prisma.fileCategory.delete({
      where: { id },
    })

    return successResponse(null, 'Categoria excluída com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
