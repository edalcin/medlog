import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { handleApiError } from '@/lib/responses'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import { getFullFilePath } from '@/lib/upload'
import { readFile } from 'fs/promises'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new ForbiddenError()
    }

    const filename = params.filename

    // Find file record
    const file = await prisma.file.findFirst({
      where: {
        path: filename,
      },
      include: {
        consultation: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!file) {
      throw new NotFoundError('Arquivo')
    }

    // Check if user owns the consultation
    if (file.consultation.userId !== session.user.id) {
      throw new ForbiddenError('Acesso negado ao arquivo')
    }

    // Read file from disk
    const filePath = getFullFilePath(filename)
    const fileBuffer = await readFile(filePath)

    // Return file with appropriate headers
    const response = new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Cache-Control': 'private, max-age=31536000', // Cache for 1 year
      },
    })

    return response
  } catch (error) {
    return handleApiError(error)
  }
}