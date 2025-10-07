import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

export interface UploadedFile {
  filename: string
  path: string
  mimeType: string
  size: number
}

export async function saveUploadedFile(
  file: File,
  consultationId?: string
): Promise<UploadedFile> {
  // Validate file type
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Tipo de arquivo não permitido. Apenas PDF, PNG e JPG são aceitos.')
  }

  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024 // 10MB
  if (file.size > maxSize) {
    throw new Error('Arquivo muito grande. Tamanho máximo: 10MB.')
  }

  // Create upload directory if it doesn't exist
  await mkdir(UPLOAD_DIR, { recursive: true })

  // Generate unique filename
  const fileExtension = file.name.split('.').pop()
  const uniqueFilename = `${randomUUID()}.${fileExtension}`
  const filePath = join(UPLOAD_DIR, uniqueFilename)

  // Convert File to buffer and save
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  await writeFile(filePath, buffer)

  return {
    filename: file.name,
    path: uniqueFilename,
    mimeType: file.type,
    size: file.size,
  }
}

export function getFileUrl(filename: string): string {
  return `/api/files/${filename}`
}

export function getFullFilePath(filename: string): string {
  return join(UPLOAD_DIR, filename)
}