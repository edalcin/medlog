import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../../lib/auth/config'
import { handleApiError } from '../../../../../lib/responses'
import { ForbiddenError } from '../../../../../lib/errors'
import { join } from 'path'
import { readFile } from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new ForbiddenError()
    }

    const thumbnailFilename = params.path
    const uploadsDir = process.env.FILES_PATH || './uploads'
    const thumbnailPath = join(uploadsDir, 'thumbnails', thumbnailFilename)

    // Read thumbnail file from disk
    const fileBuffer = await readFile(thumbnailPath)

    // Return file with appropriate headers
    const response = new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${thumbnailFilename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })

    return response
  } catch (error) {
    return handleApiError(error)
  }
}
