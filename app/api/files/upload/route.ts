import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { join } from 'path'
import { createReadStream } from 'fs'
import crypto from 'crypto'
import { authOptions } from '../../../../lib/auth/config'
import {
  successResponse,
  handleApiError,
  errorResponse,
} from '../../../../lib/responses'
import { ValidationError, NotFoundError } from '../../../../lib/errors'
import { saveUploadedFile } from '../../../../lib/upload'

const prisma = new PrismaClient()
const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

// Helper to calculate file hash from File object
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Helper to calculate file hash from disk
async function calculateFileHashFromDisk(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
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
    const categoryIds = formData.getAll('categoryIds') as string[]
    const newCategoryName = formData.get('newCategoryName') as string | null
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
    // Try to find by hash first (fast path for files with hash)
    let existingFile = await prisma.file.findFirst({
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

    // If not found by hash, check if there are files with NULL hash that might be duplicates
    // This handles legacy files uploaded before hash implementation
    if (!existingFile) {
      const filesWithoutHash = await prisma.file.findMany({
        where: {
          hash: null,
          userId: session.user.id,
        },
        select: {
          id: true,
          path: true,
          filename: true,
          customName: true,
        },
      })

      // Check each file without hash by calculating its hash and comparing
      for (const legacyFile of filesWithoutHash) {
        try {
          const fullPath = join(UPLOAD_DIR, legacyFile.path)
          const legacyFileHash = await calculateFileHashFromDisk(fullPath)

          if (legacyFileHash === fileHash) {
            // Found a duplicate! Update its hash and reject the upload
            await prisma.file.update({
              where: { id: legacyFile.id },
              data: { hash: fileHash },
            })

            existingFile = legacyFile
            break
          }
        } catch (err) {
          // File not found on disk, skip it
          continue
        }
      }
    }

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
      const professionalWhere = session.user.role === 'ADMIN'
        ? { id: professionalId }
        : {
            AND: [
              { id: professionalId },
              {
                OR: [
                  { userId: session.user.id },  // profissionais que ele criou
                  {
                    user: {
                      professionalsSharingFrom: {
                        some: { sharingToUserId: session.user.id },  // profissionais compartilhados com ele
                      },
                    },
                  },
                ],
              },
            ],
          }

      professional = await prisma.professional.findFirst({
        where: professionalWhere,
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
        userId: session.user.id,
      },
    })

    // Handle category associations
    const categoriesToAssociate: string[] = [...categoryIds]

    // Create new category if specified
    if (newCategoryName) {
      try {
        const newCategory = await prisma.fileCategory.create({
          data: {
            name: newCategoryName,
          },
        })
        categoriesToAssociate.push(newCategory.id)
      } catch (error) {
        // Category might already exist (unique constraint)
        const existingCategory = await prisma.fileCategory.findUnique({
          where: { name: newCategoryName },
        })
        if (existingCategory) {
          categoriesToAssociate.push(existingCategory.id)
        }
      }
    }

    // Associate file with categories
    if (categoriesToAssociate.length > 0) {
      for (const catId of categoriesToAssociate) {
        await prisma.fileFileCategory.create({
          data: {
            fileId: fileRecord.id,
            categoryId: catId,
          },
        }).catch(() => {
          // Ignore duplicate associations
        })
      }
    }

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
