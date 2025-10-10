import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../../lib/responses'
import { NotFoundError } from '../../../../../lib/errors'
import { unlink } from 'fs/promises'
import { getFullFilePath } from '../../../../../lib/upload'

const prisma = new PrismaClient()

export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const { filename } = params

    // Find file in database
    const file = await prisma.file.findFirst({
      where: { path: filename },
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // Delete physical file
    try {
      const filePath = getFullFilePath(filename)
      await unlink(filePath)
    } catch (err) {
      console.error('Erro ao deletar arquivo físico:', err)
      // Continue even if physical file deletion fails
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: file.id },
    })

    return successResponse(null, 'Arquivo excluído com sucesso')
  } catch (error) {
    return handleApiError(error)
  }
}
