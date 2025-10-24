import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeDuplicateRecords() {
  console.log('Removing duplicate file records from database (keeping oldest)...\n')
  console.log('='.repeat(70))

  try {
    // Find all duplicates
    const result = (await prisma.$queryRaw`
      SELECT hash, COUNT(*) as count
      FROM files
      WHERE hash IS NOT NULL
      GROUP BY hash
      HAVING count > 1
      ORDER BY count DESC
    `) as any[]

    if (result.length === 0) {
      console.log('No duplicates found!')
      return
    }

    console.log(`Found ${result.length} duplicate hashes\n`)

    let deletedCount = 0

    for (const row of result) {
      const hash = row.hash
      const count = Number(row.count)

      // Get all files with this hash, ordered by date
      const files = await prisma.file.findMany({
        where: { hash },
        select: { id: true, path: true, filename: true, uploadedAt: true, size: true },
        orderBy: { uploadedAt: 'asc' },
      })

      console.log(`Hash: ${hash}`)
      console.log(`Keeping oldest: ${files[0].filename} (${(files[0].size / 1024 / 1024).toFixed(2)} MB)`)

      // Delete all except the first (oldest) from database only
      for (let i = 1; i < files.length; i++) {
        const file = files[i]
        try {
          // Delete from database only (keep file on disk)
          await prisma.file.delete({
            where: { id: file.id },
          })

          deletedCount++

          console.log(`  ✓ Deleted record: ${file.filename}`)
        } catch (error) {
          console.error(`  ✗ Error deleting ${file.filename}:`, error)
        }
      }

      console.log()
    }

    console.log('='.repeat(70))
    console.log('\nDeletion Results:')
    console.log('='.repeat(70))
    console.log(`\n✅ Deleted: ${deletedCount} duplicate records from database`)
    console.log('Note: Files are kept on disk for safety. Remove manually if needed.')

    // Get final statistics
    const finalCount = await prisma.file.count()
    const withHash = await prisma.file.count({ where: { hash: { not: null } } })

    console.log(`\nFinal Database Status:`)
    console.log(`  Total files: ${finalCount}`)
    console.log(`  Files with hash: ${withHash}`)
    console.log(`  Coverage: ${((withHash / (finalCount || 1)) * 100).toFixed(1)}%`)

    console.log('\n' + '='.repeat(70))
    console.log('✅ Duplicate record removal complete!\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

removeDuplicateRecords()
