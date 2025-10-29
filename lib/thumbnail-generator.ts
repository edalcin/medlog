import { writeFile, mkdir, readFile } from 'fs/promises'
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
 * Generates a thumbnail for a PDF file
 * Uses Python script via child_process
 */
export async function generatePdfThumbnail(
  filePath: string,
  fileName: string,
  options: ThumbnailGeneratorOptions = {}
): Promise<string> {
  try {
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)

    // Create thumbnails directory if it doesn't exist
    await mkdir(THUMBNAILS_DIR, { recursive: true })

    const width = options.width || 200
    const height = options.height || 200
    const thumbnailFilename = `${randomUUID()}.png`
    const thumbnailPath = join(THUMBNAILS_DIR, thumbnailFilename)

    // Use Python with PIL to generate thumbnail from PDF
    // This requires: pip install pdf2image pillow
    const pythonScript = `
import sys
from pdf2image import convert_from_path
from PIL import Image

pdf_path = r'${filePath}'
output_path = r'${thumbnailPath}'
width = ${width}
height = ${height}

try:
    images = convert_from_path(pdf_path, first_page=1, last_page=1, dpi=150)
    if images:
        image = images[0]
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        image.save(output_path, 'PNG')
        print('OK')
    else:
        print('ERROR: No images generated')
except Exception as e:
    print(f'ERROR: {str(e)}')
`

    const { stdout, stderr } = await execAsync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`)

    if (stdout.includes('OK')) {
      return thumbnailFilename
    } else {
      throw new Error(stderr || 'Failed to generate PDF thumbnail')
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
