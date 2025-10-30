'use server'

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'
const THUMBNAILS_DIR = join(UPLOAD_DIR, 'thumbnails')

// Polyfill DOMMatrix for Node.js canvas
// This is required because pdfjs-dist expects DOMMatrix to be available globally
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-ignore - DOMMatrix polyfill with basic matrix operations
  globalThis.DOMMatrix = class DOMMatrix {
    a: number; b: number; c: number; d: number; e: number; f: number;

    constructor(init?: number[] | string) {
      if (Array.isArray(init)) {
        this.a = init[0] ?? 1; this.b = init[1] ?? 0;
        this.c = init[2] ?? 0; this.d = init[3] ?? 1;
        this.e = init[4] ?? 0; this.f = init[5] ?? 0;
      } else {
        this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      }
    }

    scale(scaleX: number, scaleY?: number) {
      scaleY = scaleY ?? scaleX;
      this.a *= scaleX; this.b *= scaleY;
      this.c *= scaleX; this.d *= scaleY;
      this.e *= scaleX; this.f *= scaleY;
      return this;
    }

    translate(tx: number, ty: number) {
      this.e += this.a * tx + this.c * ty;
      this.f += this.b * tx + this.d * ty;
      return this;
    }

    rotate(angle: number) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const { a, b, c, d, e, f } = this;
      this.a = a * cos + c * sin;
      this.b = b * cos + d * sin;
      this.c = c * cos - a * sin;
      this.d = d * cos - b * sin;
      return this;
    }
  }
}

interface ThumbnailGeneratorOptions {
  width?: number
  height?: number
}

// Dynamic import to load pdfjs at runtime, not build-time
async function loadPdfJs(): Promise<any> {
  return import('pdfjs-dist')
}

// CanvasFactory for Node.js canvas
// Uses dynamic require to avoid build-time errors with DOMMatrix
class NodeCanvasFactory {
  create(width: number, height: number) {
    // Dynamic require to prevent static analysis of canvas during build
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { createCanvas } = require('canvas')
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

    // Dynamic import to avoid build-time issues
    const pdfjs = await loadPdfJs()

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
