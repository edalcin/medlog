'use server'

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.FILES_PATH || './uploads'
const THUMBNAILS_DIR = join(UPLOAD_DIR, 'thumbnails')

// Polyfill Promise.withResolvers for Node.js < 22
// This is required by pdfjs-dist which uses this ES2024 feature
// @ts-ignore - Promise.withResolvers is ES2024 feature
if (typeof Promise.withResolvers === 'undefined') {
  // @ts-ignore - Promise.withResolvers polyfill
  Promise.withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void
    let reject: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve: resolve!, reject: reject! }
  }
}

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

// Load pdfjs-dist for PDF processing
async function loadPdfJs(): Promise<any> {
  console.log(`[PDF Thumbnail] Loading pdfjs-dist...`)

  // Use the legacy version which is more Node.js friendly
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  console.log(`[PDF Thumbnail] pdfjs-dist loaded successfully`)

  // Note: We don't need to configure workerSrc when passing PDF data directly
  // to getDocument(). The worker is only needed when loading from a URL.

  return pdfjs
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
    console.log(`[PDF Thumbnail] Starting generation for: ${filePath}`)

    // Create thumbnails directory if it doesn't exist
    await mkdir(THUMBNAILS_DIR, { recursive: true })
    console.log(`[PDF Thumbnail] Thumbnails directory ready: ${THUMBNAILS_DIR}`)

    const width = options.width || 200
    const height = options.height || 200

    // Dynamic import to avoid build-time issues
    console.log(`[PDF Thumbnail] Loading pdf.js...`)
    const pdfjs = await loadPdfJs()
    console.log(`[PDF Thumbnail] pdf.js loaded successfully`)

    // Load PDF document using file path directly (works better in Node.js)
    console.log(`[PDF Thumbnail] Loading PDF from: ${filePath}`)

    // Use getDocument with data parameter (works without worker configuration)
    const { readFile } = await import('fs/promises')
    const pdfData = await readFile(filePath)
    console.log(`[PDF Thumbnail] PDF file read: ${pdfData.length} bytes`)

    // Convert Buffer to Uint8Array (pdf.js requires Uint8Array, not Buffer)
    const uint8Array = new Uint8Array(pdfData)
    console.log(`[PDF Thumbnail] Converted to Uint8Array`)

    const doc = await pdfjs.getDocument({ data: uint8Array }).promise
    console.log(`[PDF Thumbnail] PDF loaded. Pages: ${doc.numPages}`)

    if (doc.numPages === 0) {
      throw new Error('PDF has no pages')
    }

    // Get first page
    const page = await doc.getPage(1)
    console.log(`[PDF Thumbnail] Page 1 loaded`)

    // Set scale for thumbnail
    const scale = 1.5
    const viewport = page.getViewport({ scale })
    console.log(`[PDF Thumbnail] Viewport: ${viewport.width}x${viewport.height}`)

    // Create canvas factory for Node.js
    const canvasFactory = new NodeCanvasFactory()
    const { canvas, context } = canvasFactory.create(viewport.width, viewport.height)
    console.log(`[PDF Thumbnail] Canvas created`)

    // Render page to canvas
    const renderContext: any = {
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }

    console.log(`[PDF Thumbnail] Rendering page...`)
    await page.render(renderContext).promise
    console.log(`[PDF Thumbnail] Page rendered successfully`)

    // Convert canvas to PNG buffer and save
    const buffer = canvas.toBuffer('image/png')
    console.log(`[PDF Thumbnail] Buffer created: ${buffer.length} bytes`)

    // Save thumbnail
    const thumbnailFilename = `${randomUUID()}.png`
    const thumbnailPath = join(THUMBNAILS_DIR, thumbnailFilename)
    await writeFile(thumbnailPath, buffer)
    console.log(`[PDF Thumbnail] Thumbnail saved: ${thumbnailPath}`)

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
