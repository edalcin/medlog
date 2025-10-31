'use server'

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'
const THUMBNAILS_DIR = join(UPLOAD_DIR, 'thumbnails')

interface ThumbnailGeneratorOptions {
  width?: number
  height?: number
}

/**
 * Generates a thumbnail for an image file
 * Supports PNG and JPG formats
 */
export async function generateImageThumbnail(
  filePath: string,
  options: ThumbnailGeneratorOptions = {}
): Promise<string> {
  try {
    const sharp = require('sharp')

    // Create thumbnails directory if it doesn't exist
    await mkdir(THUMBNAILS_DIR, { recursive: true })

    const width = options.width || 200
    const height = options.height || 200

    // Generate thumbnail using sharp
    const thumbnail = await sharp(filePath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .png({ quality: 80 })
      .toBuffer()

    // Save thumbnail
    const thumbnailFilename = `${randomUUID()}.png`
    const thumbnailPath = join(THUMBNAILS_DIR, thumbnailFilename)
    await writeFile(thumbnailPath, thumbnail)

    return thumbnailFilename
  } catch (error) {
    console.error('Error generating image thumbnail:', error)
    throw new Error(`Failed to generate thumbnail for image: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Generates a thumbnail for a PDF file using pdftoppm (poppler-utils)
 * More reliable than pdfjs in bundled Next.js environments
 */
export async function generatePdfThumbnail(
  filePath: string,
  fileName: string,
  options: ThumbnailGeneratorOptions = {}
): Promise<string> {
  try {
    console.log(`[PDF Thumbnail] Starting generation for: ${filePath}`)

    // Create thumbnails directory if it doesn't exist
    await mkdir(THUMBNAILS_DIR, { recursive: true })
    console.log(`[PDF Thumbnail] Thumbnails directory ready: ${THUMBNAILS_DIR}`)

    const width = options.width || 200
    const height = options.height || 200

    // Use pdftoppm from poppler-utils to convert PDF to PNG
    // This is more reliable than pdfjs in Docker/bundled environments
    console.log(`[PDF Thumbnail] Using pdftoppm to convert PDF...`)

    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const execFileAsync = promisify(execFile)

    const thumbnailFilename = `${randomUUID()}.png`
    const thumbnailPath = join(THUMBNAILS_DIR, thumbnailFilename)

    // pdftoppm converts PDF first page to PNG
    // -singlefile: output a single file instead of multiple pages
    // -f 1 -l 1: only convert first page
    // -png: output format
    // -W / -H: width/height
    console.log(`[PDF Thumbnail] Executing pdftoppm...`)

    try {
      await execFileAsync('pdftoppm', [
        '-singlefile',
        '-f', '1',
        '-l', '1',
        '-png',
        '-W', width.toString(),
        '-H', height.toString(),
        filePath,
        thumbnailPath,
      ])

      console.log(`[PDF Thumbnail] Thumbnail saved: ${thumbnailPath}.png`)
      return `${thumbnailFilename}.png`
    } catch (execError) {
      // Fallback: try without size parameters if pdftoppm doesn't support them
      console.log(`[PDF Thumbnail] Retrying without size parameters...`)
      await execFileAsync('pdftoppm', [
        '-singlefile',
        '-f', '1',
        '-l', '1',
        '-png',
        filePath,
        thumbnailPath,
      ])

      console.log(`[PDF Thumbnail] Thumbnail saved: ${thumbnailPath}.png`)
      return `${thumbnailFilename}.png`
    }
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error)
    throw new Error(`Failed to generate thumbnail for PDF: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Generate thumbnail based on file type
 */
export async function generateThumbnail(
  filePath: string,
  mimeType: string,
  fileName: string,
  options: ThumbnailGeneratorOptions = {}
): Promise<string> {
  if (mimeType.startsWith('image/')) {
    return generateImageThumbnail(filePath, options)
  } else if (mimeType === 'application/pdf') {
    return generatePdfThumbnail(filePath, fileName, options)
  } else {
    throw new Error(`Unsupported file type for thumbnail generation: ${mimeType}`)
  }
}
