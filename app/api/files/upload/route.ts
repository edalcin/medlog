import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import {
  successResponse,
  handleApiError,
  errorResponse,
} from '../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../lib/errors'
import { saveUploadedFile } from '../../../../lib/upload'

const prisma = new PrismaClient()

// Helper to calculate file hash
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const consultationId = formData.get('consultationId') as string | undefined
    const professionalId = formData.get('professionalId') as string | undefined
    const customName = formData.get('customName') as string | null
    const categoryId = formData.get('categoryId') as string | null
    const clientHash = formData.get('hash') as string | null

    if (!file) {
      throw new ValidationError('Arquivo é obrigatório')
    }

    // Arquivo deve estar associado a consulta OU profissional
    if (!consultationId && !professionalId) {
      throw new ValidationError('Associe o arquivo a uma consulta ou profissional')
    }

    // Calculate server-side hash for verification
    const fileHash = await calculateFileHash(file)

    // Verify hash matches what client calculated
    if (clientHash && clientHash !== fileHash) {
      return errorResponse('Hash do arquivo não corresponde. Tente novamente.', 400)
    }

    // Check if file already exists (duplicate detection)
    const existingFile = await prisma.file.findFirst({
      where: {
        hash: fileHash,
        userId: session.user.id,
      },
      select: {
        id: true,
        filename: true,
        customName: true,
      },
    })

    if (existingFile) {
      return errorResponse(
        `Arquivo duplicado! Um arquivo idêntico já existe: "${existingFile.customName || existingFile.filename}"`,
        409
      )
    }

    // Verify consultation exists and belongs to user (or user is admin)
    let consultation = null
    if (consultationId) {
      consultation = await prisma.consultation.findFirst({
        where: {
          id: consultationId,
          ...(session.user.role !== 'ADMIN' ? { userId: session.user.id } : {}),
        },
        include: {
          professional: true,
        },
      })

      if (!consultation) {
        throw new NotFoundError('Consulta')
      }
    }

    // Verify professional exists and belongs to user (or user is admin)
    let professional = null
    if (professionalId) {
      professional = await prisma.professional.findFirst({
        where: {
          id: professionalId,
          ...(session.user.role !== 'ADMIN' ? { userId: session.user.id } : {}),
        },
      })

      if (!professional) {
        throw new NotFoundError('Profissional')
      }
    }

    // Save file to disk
    const uploadedFile = await saveUploadedFile(file)

    // Create file record in database
    const fileRecord = await prisma.file.create({
      data: {
        filename: file.name,
        customName: customName || null,
        path: uploadedFile.path,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        hash: fileHash,
        thumbnailPath: uploadedFile.thumbnailPath || null,
        consultationId: consultationId || null,
        // If associated with consultation, also associate with its professional
        professionalId: consultation?.professionalId || professionalId || null,
        categoryId: categoryId || null,
        userId: session.user.id,
      },
    })

    return successResponse(
      {
        id: fileRecord.id,
        filename: fileRecord.filename,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        url: `/api/files/${fileRecord.path}`,
        createdAt: fileRecord.uploadedAt,
      },
      'Arquivo enviado com sucesso',
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
