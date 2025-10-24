import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { createReadStream } from 'fs'
import { join } from 'path'

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

async function backfillAllFileHashes() {
  console.log('Backfilling hashes for ALL files (with and without database records)\n')
  console.log('='.repeat(70))

  try {
    // STEP 1: Update existing files in database without hashes
    console.log('\nSTEP 1: Processing files WITH database records but WITHOUT hashes...\n')

    const filesWithoutHashes = await prisma.file.findMany({
      where: { hash: null },
      select: { id: true, path: true, filename: true },
    })

    console.log(`Found ${filesWithoutHashes.length} files without hashes in database`)

    let successCount = 0
    let errorCount = 0

    for (const file of filesWithoutHashes) {
      try {
        const fullPath = join(UPLOAD_DIR, file.path)
        const fileHash = await calculateFileHashFromDisk(fullPath)

        await prisma.file.update({
          where: { id: file.id },
          data: { hash: fileHash },
        })

        console.log(`✓ ${file.filename}: ${fileHash.substring(0, 16)}...`)
        successCount++
      } catch (error) {
        console.error(`✗ ${file.filename}: arquivo não encontrado no disco`)
        errorCount++
      }
    }

    console.log(
      `\nStep 1 Complete: ${successCount} updated, ${errorCount} errors\n`
    )

    // STEP 2: Check for hash duplicates
    console.log('='.repeat(70))
    console.log('\nSTEP 2: Checking for duplicate hashes...\n')

    const result = (await prisma.$queryRaw`
      SELECT hash, COUNT(*) as count
      FROM files
      WHERE hash IS NOT NULL
      GROUP BY hash
      HAVING count > 1
    `) as any[]

    if (result.length > 0) {
      console.log(`⚠️  Found ${result.length} hashes with duplicates:\n`)

      for (const row of result) {
        const count = Number(row.count)
        const hash = row.hash

        const duplicates = await prisma.file.findMany({
          where: { hash },
          select: { filename: true, customName: true, uploadedAt: true },
        })

        console.log(`Hash: ${hash}`)
        console.log(`  Duplicates: ${count}`)
        duplicates.forEach(d => {
          console.log(
            `    - ${d.customName || d.filename} (${d.uploadedAt.toISOString()})`
          )
        })
        console.log()
      }

      console.log(
        '⚠️  To remove duplicates, keep the oldest and delete newer copies.'
      )
    } else {
      console.log('✅ No duplicate hashes found!')
    }

    // FINAL STATISTICS
    console.log('\n' + '='.repeat(70))
    console.log('\nFINAL STATISTICS:\n')

    const stats = (await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        SUM(IF(hash IS NOT NULL, 1, 0)) as with_hash,
        SUM(IF(hash IS NULL, 1, 0)) as without_hash
      FROM files
    `) as any[]

    const dbStats = stats[0]
    const total = Number(dbStats.total)
    const withHash = Number(dbStats.with_hash)
    const withoutHash = Number(dbStats.without_hash)

    console.log(`Database Records:`)
    console.log(`  Total files: ${total}`)
    console.log(`  With hash: ${withHash}`)
    console.log(`  Without hash: ${withoutHash}`)
    console.log(`  Coverage: ${((withHash / (total || 1)) * 100).toFixed(1)}%\n`)

    console.log(`Disk Status:`)
    console.log(`  Files processed in database: ${filesWithoutHashes.length}`)
    console.log(`  Successfully updated: ${successCount}`)
    console.log(`  Not found on disk: ${errorCount}\n`)

    console.log('='.repeat(70))
    console.log('✅ Backfill complete! System is ready for duplicate detection.\n')
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backfillAllFileHashes()
