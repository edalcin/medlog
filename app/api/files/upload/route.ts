import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/auth/config'
import { successResponse, handleApiError, errorResponse } from '../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../lib/errors'
import { saveUploadedFile } from '../../../../lib/upload'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return errorResponse('Não autorizado', 401)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const consultationId = formData.get('consultationId') as string

    if (!file) {
      throw new ValidationError('Arquivo é obrigatório')
    }

    if (!consultationId) {
      throw new ValidationError('ID da consulta é obrigatório')
    }

    // Verify consultation exists and belongs to user
    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        userId: session.user.id,
      },
      include: {
        professional: true,
      },
    })

    if (!consultation) {
      throw new NotFoundError('Consulta')
    }

    // Save file
    const uploadedFile = await saveUploadedFile(file)

    // Create file record in database
    const fileRecord = await prisma.file.create({
      data: {
        filename: file.name,
        path: uploadedFile.path,
        mimeType: uploadedFile.mimeType,
        size: uploadedFile.size,
        consultationId,
        professionalId: consultation.professionalId,
      },
    })

    return successResponse({
      id: fileRecord.id,
      filename: fileRecord.filename,
      mimeType: fileRecord.mimeType,
      size: fileRecord.size,
      url: `/api/files/${fileRecord.path}`,
      createdAt: fileRecord.uploadedAt,
    }, 'Arquivo enviado com sucesso', 201)
  } catch (error) {
    return handleApiError(error)
  }
}