import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { createReadStream, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const prisma = new PrismaClient()
const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

async function calculateFileHashFromDisk(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function getMimeType(filename: string): Promise<string> {
  const ext = extname(filename).toLowerCase()
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

async function syncDiskToDb() {
  console.log('Syncing files from disk to database...\n')
  console.log('='.repeat(70))

  try {
    // Get all files on disk
    const filesOnDisk = readdirSync(UPLOAD_DIR).filter(
      f => f !== 'thumbnails' && f !== 'generate_pdf_thumbnails.py'
    )

    console.log(`\nFound ${filesOnDisk.length} files on disk\n`)

    // Get all files in database
    const filesInDb = await prisma.file.findMany({
      select: { path: true },
    })
    const filesInDbSet = new Set(filesInDb.map(f => f.path))

    console.log(`Found ${filesInDb.length} files in database\n`)

    // Find orphan files (on disk but not in DB)
    const orphanFiles = filesOnDisk.filter(f => !filesInDbSet.has(f))

    if (orphanFiles.length === 0) {
      console.log('✅ All disk files are in database!')
      return
    }

    console.log(`Found ${orphanFiles.length} orphan files to import\n`)
    console.log('='.repeat(70))
    console.log(`\nImporting ${orphanFiles.length} files...\n`)

    let successCount = 0
    let errorCount = 0

    for (const filename of orphanFiles) {
      try {
        const fullPath = join(UPLOAD_DIR, filename)
        const stats = statSync(fullPath)

        // Calculate hash
        const hash = await calculateFileHashFromDisk(fullPath)

        // Determine mime type
        const mimeType = await getMimeType(filename)

        // Create file record
        await prisma.file.create({
          data: {
            filename: filename,
            path: filename,
            mimeType: mimeType,
            size: stats.size,
            hash: hash,
            uploadedAt: new Date(stats.mtime),
          },
        })

        console.log(
          `✓ Imported: ${filename} (${(stats.size / 1024).toFixed(2)} KB, hash: ${hash.substring(0, 16)}...)`
        )
        successCount++
      } catch (error) {
        console.error(`✗ Error importing ${filename}:`, error)
        errorCount++
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('\nImport Results:')
    console.log('='.repeat(70))
    console.log(`\n✅ Successfully imported: ${successCount} files`)
    console.log(`❌ Errors: ${errorCount} files`)

    // Get final statistics
    const finalCount = await prisma.file.count()
    const withHash = await prisma.file.count({ where: { hash: { not: null } } })

    console.log(`\nFinal Database Status:`)
    console.log(`  Total files: ${finalCount}`)
    console.log(`  Files with hash: ${withHash}`)
    console.log(`  Coverage: ${((withHash / (finalCount || 1)) * 100).toFixed(1)}%`)

    console.log('\n' + '='.repeat(70))
    console.log('✅ Sync complete! All files are now in the database with hashes.\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

syncDiskToDb()
