import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import * as pdfjs from 'pdfjs-dist'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'
const THUMBNAILS_DIR = join(UPLOAD_DIR, 'thumbnails')

interface ThumbnailGeneratorOptions {
  width?: number
  height?: number
}

// Check if canvas is available (optional dependency for production)
let Canvas: any = null
let createCanvas: any = null
let canvasAvailable = false

try {
  const canvasModule = require('canvas')
  Canvas = canvasModule.Canvas
  createCanvas = canvasModule.createCanvas
  canvasAvailable = true
} catch (error) {
  // Canvas not available in production - PDF thumbnails will not be generated
  console.warn('Canvas module not available. PDF thumbnail generation disabled.')
}

// CanvasFactory for Node.js canvas
class NodeCanvasFactory {
  create(width: number, height: number) {
    if (!canvasAvailable || !createCanvas) {
      throw new Error('Canvas module not available. Cannot generate PDF thumbnails.')
    }
    const canvas = createCanvas(width, height)
    return {
      canvas,
      context: canvas.getContext('2d'),
    }
  }

  reset(canvasAndContext: { canvas: any; context: any }) {
    const { canvas } = canvasAndContext
    canvas.width = 0
    canvas.height = 0
  }

  destroy(canvasAndContext: { canvas: any; context: any }) {
    // No need to explicitly destroy canvas in Node.js
  }
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
 * Generates a thumbnail for a PDF file using pdfjs-dist
 * Works cross-platform without Python dependencies
 */
export async function generatePdfThumbnail(
  filePath: string,
  fileName: string,
  options: ThumbnailGeneratorOptions = {}
): Promise<string> {
  try {
    // Create thumbnails directory if it doesn't exist
    await mkdir(THUMBNAILS_DIR, { recursive: true })

    const width = options.width || 200
    const height = options.height || 200

    // Load PDF document
    const doc = await pdfjs.getDocument(filePath).promise

    if (doc.numPages === 0) {
      throw new Error('PDF has no pages')
    }

    // Get first page
    const page = await doc.getPage(1)

    // Set scale for thumbnail
    const scale = 1.5
    const viewport = page.getViewport({ scale })

    // Create canvas factory for Node.js
    const canvasFactory = new NodeCanvasFactory()
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height)

    // Render page to canvas
    const renderContext: any = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }

    await page.render(renderContext).promise

    // Convert canvas to PNG buffer and save
    const buffer = canvas.toBuffer('image/png')

    // Save thumbnail
    const thumbnailFilename = `${randomUUID()}.png`
    const thumbnailPath = join(THUMBNAILS_DIR, thumbnailFilename)
    await writeFile(thumbnailPath, buffer)

    return thumbnailFilename
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
