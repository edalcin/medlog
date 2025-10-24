import { PrismaClient } from '@prisma/client'
import { existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const UPLOAD_DIR = process.env.FILES_PATH || './uploads'

async function cleanMissingFiles() {
  console.log('Cleaning missing files from database...\n')
  console.log('='.repeat(70))

  try {
    // Find all files in database
    const allFiles = await prisma.file.findMany({
      select: {
        id: true,
        path: true,
        filename: true,
        customName: true,
      },
    })

    console.log(`Found ${allFiles.length} files in database\n`)

    // Check which ones don't exist on disk
    const missingFiles = []
    const existingFiles = []

    for (const file of allFiles) {
      const fullPath = join(UPLOAD_DIR, file.path)
      if (existsSync(fullPath)) {
        existingFiles.push(file)
      } else {
        missingFiles.push(file)
      }
    }

    console.log(`✓ Files on disk: ${existingFiles.length}`)
    console.log(`✗ Missing files: ${missingFiles.length}\n`)

    if (missingFiles.length === 0) {
      console.log('No missing files found. Database is clean!')
      return
    }

    console.log('='.repeat(70))
    console.log(`\nDeleting ${missingFiles.length} missing files from database...\n`)

    // Delete missing files
    let deletedCount = 0
    for (const file of missingFiles) {
      try {
        await prisma.file.delete({
          where: { id: file.id },
        })
        deletedCount++
        console.log(`✓ Deleted: ${file.filename} (${file.customName || 'sem nome customizado'})`)
      } catch (error) {
        console.error(`✗ Failed to delete ${file.filename}:`, error)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('\nCleanup Results:')
    console.log('='.repeat(70))

    // Get final statistics
    const finalCount = await prisma.file.count()
    const withHash = await prisma.file.count({ where: { hash: { not: null } } })

    console.log(`\n✅ Deleted: ${deletedCount} files`)
    console.log(`\nFinal Database Status:`)
    console.log(`  Total files: ${finalCount}`)
    console.log(`  Files with hash: ${withHash}`)
    console.log(`  Coverage: ${((withHash / (finalCount || 1)) * 100).toFixed(1)}%`)

    console.log('\n✅ Database cleanup complete!')
    console.log('Now all files in the database have corresponding files on disk.')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanMissingFiles()
