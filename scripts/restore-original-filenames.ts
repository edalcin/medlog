import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()
const BACKUP_FILE = 'H:/git/medlog/backup/mariadb_medlog_192.168.1.10_20251023-030004.sql'

interface BackupFileData {
  id: string
  originalFilename: string
  path: string
}

async function parseBackupForFilenames(): Promise<BackupFileData[]> {
  console.log(`Parsing backup file for original filenames: ${BACKUP_FILE}\n`)

  const fileContent = readFileSync(BACKUP_FILE, 'utf8')
  const records: BackupFileData[] = []

  // Find the INSERT INTO `files` VALUES section
  const startIdx = fileContent.indexOf("INSERT INTO `files` VALUES\n")
  const endIdx = fileContent.indexOf("\n/*!40000 ALTER TABLE `files` ENABLE KEYS", startIdx)

  if (startIdx === -1 || endIdx === -1) {
    console.log('⚠ Could not find INSERT INTO files section')
    return records
  }

  const valuesSection = fileContent.substring(startIdx, endIdx)
  const lines = valuesSection.split('\n')

  for (const line of lines) {
    if (!line.trim().startsWith('(') || line.includes('INSERT INTO')) {
      continue
    }

    // Extract: id, filename, path (the first 3 fields)
    const match = line.match(/\('([^']*)',\s*'([^']*)',\s*'([^']*)'/);

    if (!match) {
      continue
    }

    const [, id, originalFilename, path] = match

    records.push({
      id,
      originalFilename,
      path,
    })
  }

  console.log(`✓ Found ${records.length} files in backup\n`)
  return records
}

async function restoreFilenames() {
  console.log('='.repeat(70))
  console.log('RESTORING ORIGINAL FILENAMES')
  console.log('='.repeat(70))

  try {
    const backupRecords = await parseBackupForFilenames()

    if (backupRecords.length === 0) {
      console.error('❌ No files found in backup')
      process.exit(1)
    }

    console.log(`Processing ${backupRecords.length} files to restore names...\n`)

    let updated = 0
    let notFound = 0
    let errors = 0
    let unchanged = 0

    for (const backupRecord of backupRecords) {
      try {
        // Find file by path (which is the UUID in the database)
        const existingFile = await prisma.file.findFirst({
          where: {
            path: backupRecord.path,
          },
        })

        if (existingFile) {
          // Check if filename is already correct
          if (existingFile.filename === backupRecord.originalFilename) {
            unchanged++
            continue
          }

          // Update filename to original name
          await prisma.file.update({
            where: { id: existingFile.id },
            data: {
              filename: backupRecord.originalFilename,
            },
          })

          console.log(
            `✓ ${backupRecord.path.substring(0, 8)}... → ${backupRecord.originalFilename}`
          )
          updated++
        } else {
          notFound++
        }
      } catch (error) {
        console.error(`✗ Error processing ${backupRecord.id}:`, error)
        errors++
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('RESTORATION RESULTS')
    console.log('='.repeat(70))

    console.log(`\n✅ Updated: ${updated} files`)
    console.log(`📌 Unchanged: ${unchanged} files`)
    console.log(`⚠ Not found: ${notFound} files`)
    console.log(`❌ Errors: ${errors} files`)

    const finalStats = await prisma.file.findMany({
      select: {
        filename: true,
      },
    })

    console.log(`\nFinal Database Status:`)
    console.log(`  Total files: ${finalStats.length}`)

    console.log('\n' + '='.repeat(70))
    console.log('✅ Restoration complete!\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

restoreFilenames()
