import { PrismaClient } from '@prisma/client'
import { createReadStream } from 'fs'
import { join } from 'path'
import crypto from 'crypto'

const prisma = new PrismaClient()
const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

/**
 * Calculate SHA256 hash of a file from disk
 */
async function calculateFileHashFromDisk(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * Backfill hashes for all files in the database
 */
async function backfillFileHashes() {
  console.log('Starting backfill of file hashes...')

  try {
    // Get all files without hashes
    const filesWithoutHashes = await prisma.file.findMany({
      where: {
        hash: null,
      },
      select: {
        id: true,
        path: true,
        filename: true,
      },
    })

    console.log(`Found ${filesWithoutHashes.length} files without hashes`)

    if (filesWithoutHashes.length === 0) {
      console.log('All files already have hashes. Exiting.')
      return
    }

    let successCount = 0
    let errorCount = 0

    for (const file of filesWithoutHashes) {
      try {
        const fullPath = join(UPLOAD_DIR, file.path)
        console.log(`Processing: ${file.filename} (${file.id})...`)

        // Calculate hash from disk
        const hash = await calculateFileHashFromDisk(fullPath)

        // Check if this hash already exists (from another user or file)
        const existingHash = await prisma.file.findFirst({
          where: {
            hash: hash,
            NOT: {
              id: file.id,
            },
          },
        })

        if (existingHash) {
          console.warn(
            `  WARNING: Hash collision detected! File ${file.id} has same hash as ${existingHash.id}`
          )
          console.warn(
            `  This indicates these are duplicate files. Consider manual cleanup.`
          )
        }

        // Update file with hash
        await prisma.file.update({
          where: { id: file.id },
          data: { hash },
        })

        console.log(`  ✓ Hash calculated and stored: ${hash.substring(0, 16)}...`)
        successCount++
      } catch (error) {
        console.error(`  ✗ Error processing file ${file.id}:`, error)
        errorCount++
      }
    }

    console.log(`\nBackfill complete!`)
    console.log(`  Success: ${successCount}`)
    console.log(`  Errors: ${errorCount}`)
  } catch (error) {
    console.error('Fatal error during backfill:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillFileHashes()
