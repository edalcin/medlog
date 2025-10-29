import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { generateThumbnail } from '@/lib/thumbnail-generator'
import { join } from 'path'
import { existsSync } from 'fs'
import {
  successResponse,
  handleApiError,
  errorResponse,
} from '@/lib/responses'
import { NotFoundError, ForbiddenError } from '@/lib/errors'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Only admins can generate thumbnails
    if (!session || session.user?.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can generate thumbnails')
    }

    const fileId = params.id

    // Fetch file from database
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    })

    if (!file) {
      throw new NotFoundError('File')
    }

    // Check if thumbnail already exists
    if (file.thumbnailPath) {
      return errorResponse('Este arquivo já possui um thumbnail gerado', 400)
    }

    // Check if file type supports thumbnail generation
    if (file.mimeType !== 'application/pdf' && !file.mimeType.startsWith('image/')) {
      return errorResponse('Este tipo de arquivo não suporta geração de thumbnail', 400)
    }

    // Check if file exists on disk
    const filePath = join(UPLOAD_DIR, file.path)
    if (!existsSync(filePath)) {
      return errorResponse('Arquivo não encontrado no disco', 404)
    }

    // Generate thumbnail
    const thumbnailPath = await generateThumbnail(
      filePath,
      file.mimeType,
      file.filename
    )

    // Update file record with thumbnail path
    await prisma.file.update({
      where: { id: fileId },
      data: { thumbnailPath },
    })

    return successResponse(
      {
        id: file.id,
        thumbnailPath,
      },
      'Thumbnail gerado com sucesso',
      200
    )
  } catch (error) {
    return handleApiError(error)
  }
}
