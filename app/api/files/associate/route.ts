import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const body = await request.json()
    const { consultationId, fileIds } = body

    if (!consultationId) {
      return errorResponse('ID da consulta é obrigatório', 400)
    }

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return errorResponse('IDs dos arquivos são obrigatórios', 400)
    }

    // Verify consultation exists and user has access
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { user: true },
    })

    if (!consultation) {
      return errorResponse('Consulta não encontrada', 404)
    }

    // Only allow the owner or admin to associate files
    if (consultation.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return errorResponse('Você não tem permissão para associar arquivos a esta consulta', 403)
    }

    // Update files to associate them with the consultation
    const updatedFiles = await prisma.file.updateMany({
      where: {
        id: { in: fileIds },
      },
      data: {
        consultationId: consultationId,
        professionalId: consultation.professionalId,
      },
    })

    return successResponse(
      { count: updatedFiles.count },
      `${updatedFiles.count} arquivo(s) associado(s) com sucesso`
    )
  } catch (error) {
    return handleApiError(error)
  }
}
