import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../../lib/responses'
import { NotFoundError, ForbiddenError } from '../../../../../lib/errors'
import { unlink } from 'fs/promises'
import { getFullFilePath } from '../../../../../lib/upload'

const prisma = new PrismaClient()

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const fileId = params.id

    // Find file and check ownership
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        consultation: {
          select: { id: true, date: true, userId: true },
        },
        professional: {
          select: { id: true, name: true },
        },
      },
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // Check if user owns the file or is admin
    if (file.userId !== session.user.id && session.user.role !== 'ADMIN') {
      throw new ForbiddenError('Você não tem permissão para deletar este arquivo')
    }

    // Delete physical file
    try {
      const filePath = getFullFilePath(file.path)
      await unlink(filePath)
    } catch (err) {
      console.error('Erro ao deletar arquivo físico:', err)
      // Continue even if physical file deletion fails
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: fileId },
    })

    return successResponse(
      null,
      'Arquivo excluído com sucesso'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
