import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { createReadStream, existsSync, readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const UPLOAD_DIR = process.env.FILES_PATH || './uploads'
const BACKUP_FILE = 'H:/git/medlog/backup/mariadb_medlog_192.168.1.10_20251023-030004.sql'

interface BackupFileRecord {
  id: string
  filename: string
  path: string
  mimeType: string
  size: number
  consultationId?: string
  professionalId?: string
  categoryId?: string
  userId?: string
  customName?: string
  uploadedAt: string
  thumbnailPath?: string
}

async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function parseBackupSQL(backupPath: string): Promise<BackupFileRecord[]> {
  console.log(`Parsing backup file: ${backupPath}\n`)

  const fileContent = readFileSync(backupPath, 'utf8')
  const records: BackupFileRecord[] = []

  // Find the INSERT INTO `files` VALUES section and extract everything until the end
  const startIdx = fileContent.indexOf("INSERT INTO `files` VALUES\n")
  const endIdx = fileContent.indexOf("\n/*!40000 ALTER TABLE `files` ENABLE KEYS", startIdx)

  if (startIdx === -1 || endIdx === -1) {
    console.log('⚠ Could not find INSERT INTO files section')
    return records
  }

  const valuesSection = fileContent.substring(startIdx, endIdx)

  // Parse each row using a simple line-by-line approach
  // Each row is formatted as ('id','filename','path','mime',size,'consultationId','professionalId',uploadedAt,'categoryId','customName','userId',NULL/hash,'thumbnailPath'),
  const lines = valuesSection.split('\n')

  for (const line of lines) {
    // Skip non-data lines
    if (!line.trim().startsWith('(') || line.includes('INSERT INTO')) {
      continue
    }

    // Extract the tuple content
    const match = line.match(/\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*'([^']*)'\s*,\s*(?:'([^']*)'|NULL)\s*,\s*'([^']*)'\s*,\s*(?:'([^']*)'|NULL)\s*,\s*(?:NULL|'([^']*)')\s*,\s*'([^']*)'\s*,\s*(?:NULL|'([^']*)')\s*,\s*(?:NULL|'([^']*)')\)/);

    if (!match) {
      continue
    }

    const [
      ,
      id,
      filename,
      path,
      mimeType,
      size,
      consultationId,
      professionalId,
      uploadedAt,
      categoryId,
      customName,
      userId,
      hash,
      thumbnailPath,
    ] = match

    const record: BackupFileRecord = {
      id,
      filename,
      path,
      mimeType,
      size: parseInt(size),
      uploadedAt,
      consultationId: consultationId && consultationId !== 'NULL' ? consultationId : undefined,
      professionalId: professionalId && professionalId !== 'NULL' ? professionalId : undefined,
      categoryId: categoryId && categoryId !== 'NULL' ? categoryId : undefined,
      customName: customName && customName !== 'NULL' ? customName : undefined,
      userId: userId && userId !== 'NULL' ? userId : undefined,
      thumbnailPath: thumbnailPath && thumbnailPath !== 'NULL' ? thumbnailPath : undefined,
    }

    // Only include files that have a consultation ID
    if (record.consultationId) {
      records.push(record)
    }
  }

  console.log(`✓ Found ${records.length} files with consultation associations in backup\n`)
  return records
}

async function recoverFromBackup() {
  console.log('='.repeat(70))
  console.log('RECOVERING FILE ASSOCIATIONS FROM BACKUP')
  console.log('='.repeat(70))

  try {
    if (!existsSync(BACKUP_FILE)) {
      console.error(`❌ Backup file not found: ${BACKUP_FILE}`)
      process.exit(1)
    }

    // Parse backup
    const backupRecords = await parseBackupSQL(BACKUP_FILE)

    if (backupRecords.length === 0) {
      console.error('❌ No files found in backup')
      process.exit(1)
    }

    console.log('='.repeat(70))
    console.log('RECOVERING FILES AND ASSOCIATIONS')
    console.log('='.repeat(70))
    console.log(`\nProcessing ${backupRecords.length} files from backup...\n`)

    let recovered = 0
    let notFound = 0
    let errors = 0

    for (const backupRecord of backupRecords) {
      try {
        // Check if file exists in database by filename
        let existingFile = await prisma.file.findFirst({
          where: {
            filename: backupRecord.filename,
          },
        })

        // If not found by filename, try by path
        if (!existingFile) {
          existingFile = await prisma.file.findFirst({
            where: {
              path: backupRecord.path,
            },
          })
        }

        if (existingFile) {
          // File exists in DB - update with associations and hash if missing
          try {
            const filePath = join(UPLOAD_DIR, existingFile.path)

            if (existsSync(filePath)) {
              // Calculate hash if not present
              let hash = existingFile.hash
              if (!hash) {
                hash = await calculateFileHash(filePath)
              }

              // Update with associations
              await prisma.file.update({
                where: { id: existingFile.id },
                data: {
                  hash,
                  consultationId: backupRecord.consultationId,
                  professionalId: backupRecord.professionalId,
                  userId: backupRecord.userId,
                  thumbnailPath: backupRecord.thumbnailPath,
                },
              })

              console.log(
                `✓ ${backupRecord.filename} (consultation: ${backupRecord.consultationId ? '✓' : '✗'}, hash: ${hash.substring(0, 12)}...)`
              )
              recovered++
            } else {
              console.log(`⚠ File not found on disk: ${backupRecord.filename}`)
              notFound++
            }
          } catch (error) {
            console.error(`✗ Error processing ${backupRecord.filename}:`, error)
            errors++
          }
        } else {
          // File not in current database - create it
          try {
            const filePath = join(UPLOAD_DIR, backupRecord.path)

            if (existsSync(filePath)) {
              const hash = await calculateFileHash(filePath)

              await prisma.file.create({
                data: {
                  id: backupRecord.id,
                  filename: backupRecord.filename,
                  path: backupRecord.path,
                  mimeType: backupRecord.mimeType,
                  size: backupRecord.size,
                  hash,
                  consultationId: backupRecord.consultationId,
                  professionalId: backupRecord.professionalId,
                  userId: backupRecord.userId,
                  customName: backupRecord.customName,
                  thumbnailPath: backupRecord.thumbnailPath,
                },
              })

              console.log(
                `+ ${backupRecord.filename} (NEW, consultation: ${backupRecord.consultationId ? '✓' : '✗'}, hash: ${hash.substring(0, 12)}...)`
              )
              recovered++
            } else {
              console.log(`⚠ File not found on disk: ${backupRecord.filename}`)
              notFound++
            }
          } catch (createError: any) {
            if (createError.code === 'P2002') {
              // Unique constraint violation - file already exists
              console.log(`~ ${backupRecord.filename} (already exists, updating associations)`)
              const existingFile = await prisma.file.findUnique({
                where: { id: backupRecord.id },
              })
              if (existingFile) {
                const filePath = join(UPLOAD_DIR, existingFile.path)
                let hash = existingFile.hash
                if (!hash && existsSync(filePath)) {
                  hash = await calculateFileHash(filePath)
                }

                await prisma.file.update({
                  where: { id: backupRecord.id },
                  data: {
                    consultationId: backupRecord.consultationId,
                    professionalId: backupRecord.professionalId,
                    userId: backupRecord.userId,
                    hash,
                    thumbnailPath: backupRecord.thumbnailPath,
                  },
                })
                recovered++
              }
            } else {
              console.error(`✗ Error creating ${backupRecord.filename}:`, createError)
              errors++
            }
          }
        }
      } catch (error) {
        console.error(`✗ Error processing ${backupRecord.filename}:`, error)
        errors++
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('RECOVERY RESULTS')
    console.log('='.repeat(70))

    const finalStats = await prisma.file.findMany({
      where: {
        consultationId: { not: null },
      },
      select: {
        id: true,
        filename: true,
        hash: true,
      },
    })

    const withHash = finalStats.filter(f => f.hash).length

    console.log(`\n✅ Recovered: ${recovered} file associations`)
    console.log(`⚠ Not found on disk: ${notFound} files`)
    console.log(`❌ Errors: ${errors} files`)

    console.log(`\nFinal Database Status:`)
    console.log(`  Total files: ${await prisma.file.count()}`)
    console.log(`  Files with consultations: ${finalStats.length}`)
    console.log(`  Files with hash: ${withHash}`)
    console.log(`  Hash coverage (associated): ${((withHash / (finalStats.length || 1)) * 100).toFixed(1)}%`)

    console.log('\n' + '='.repeat(70))
    console.log('✅ Recovery complete!\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

recoverFromBackup()
