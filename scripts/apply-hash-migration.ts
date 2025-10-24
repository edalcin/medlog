import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('Applying hash field migration...')

    // Check if hash column already exists
    const result = await prisma.$queryRaw`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'files' AND COLUMN_NAME = 'hash'
    ` as any[]

    if (result.length > 0) {
      console.log('Hash field already exists in database. Skipping migration.')
      return
    }

    console.log('Adding hash column to files table...')
    await prisma.$executeRaw`
      ALTER TABLE files ADD COLUMN hash VARCHAR(64) UNIQUE
    `

    console.log('Creating index on hash column...')
    await prisma.$executeRaw`
      CREATE INDEX files_hash_idx ON files(hash)
    `

    console.log('✓ Migration applied successfully!')
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()
