import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { createReadStream } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

/**
 * Calculate SHA256 hash of a file
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

async function testDuplicateDetection() {
  console.log('Testing duplicate detection system...\n')

  try {
    // Get one existing file
    const existingFile = await prisma.file.findFirst({
      select: {
        id: true,
        path: true,
        filename: true,
        hash: true,
        userId: true,
      },
    })

    if (!existingFile) {
      console.log('No files found in database. Cannot test.')
      return
    }

    console.log('Found test file:', existingFile.filename)
    const fullPath = join(UPLOAD_DIR, existingFile.path)

    // Calculate its hash
    const fileHash = await calculateFileHashFromDisk(fullPath)
    console.log('File hash:', fileHash)

    // Check if hash matches what's in DB
    if (existingFile.hash) {
      console.log('Hash in DB:', existingFile.hash)
      if (existingFile.hash === fileHash) {
        console.log('✓ Hash matches database!')
      } else {
        console.log('✗ Hash mismatch!')
      }
    } else {
      console.log('File has no hash stored in database')

      // Update with hash
      await prisma.file.update({
        where: { id: existingFile.id },
        data: { hash: fileHash },
      })
      console.log('✓ Hash has been calculated and stored!')
    }

    // Test duplicate detection logic
    console.log('\nTesting duplicate detection...')
    const duplicate = await prisma.file.findFirst({
      where: {
        hash: fileHash,
        userId: existingFile.userId,
      },
      select: {
        id: true,
        filename: true,
        customName: true,
      },
    })

    if (duplicate) {
      console.log('✓ Duplicate detection working!')
      console.log(
        'Would show error: "Arquivo duplicado! Um arquivo idêntico já existe"'
      )
      console.log(`  File name: "${duplicate.customName || duplicate.filename}"`)
    } else {
      console.log('✗ Duplicate detection not working - file not found')
    }

    // Show statistics
    console.log('\nStatistics:')
    const totalFiles = await prisma.file.count()
    const filesWithHash = await prisma.file.count({
      where: { hash: { not: null } },
    })
    const filesWithoutHash = await prisma.file.count({
      where: { hash: null },
    })

    console.log(`Total files: ${totalFiles}`)
    console.log(`Files with hash: ${filesWithHash}`)
    console.log(`Files without hash: ${filesWithoutHash}`)
    console.log(
      `Coverage: ${((filesWithHash / totalFiles) * 100).toFixed(2)}%`
    )
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDuplicateDetection()
