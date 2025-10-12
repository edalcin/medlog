import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../../lib/responses'
import { ValidationError } from '../../../../../lib/errors'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return errorResponse('Não autorizado', 401)
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('IDs são obrigatórios')
    }

    // Get all files from consultations to be deleted
    const consultations = await prisma.consultation.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: {
        files: {
          select: {
            path: true,
          },
        },
      },
    })

    // Delete physical files before deleting consultations
    const fs = require('fs')
    const path = require('path')
    const uploadsDir = process.env.FILES_PATH || path.join(process.cwd(), 'uploads')

    for (const consultation of consultations) {
      for (const file of consultation.files) {
        try {
          const filePath = path.join(uploadsDir, file.path)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
        } catch (fileError) {
          console.error(`Erro ao deletar arquivo físico ${file.path}:`, fileError)
          // Continue even if file deletion fails
        }
      }
    }

    // Delete consultations (files records will be cascade deleted)
    const result = await prisma.consultation.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    })

    return successResponse(
      { deletedCount: result.count },
      `${result.count} consulta(s) e arquivos removidos com sucesso`
    )
  } catch (error) {
    return handleApiError(error)
  }
}
