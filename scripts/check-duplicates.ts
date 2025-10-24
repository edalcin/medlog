import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicates() {
  console.log('Checking for duplicate hashes...\n')

  try {
    const result = (await prisma.$queryRaw`
      SELECT hash, COUNT(*) as count
      FROM files
      WHERE hash IS NOT NULL
      GROUP BY hash
      HAVING count > 1
      ORDER BY count DESC
    `) as any[]

    if (result.length === 0) {
      console.log('✅ No duplicate hashes found!')
      return
    }

    console.log(`⚠️  Found ${result.length} hashes with duplicates:\n`)

    for (const row of result) {
      const count = Number(row.count)
      const hash = row.hash

      const files = await prisma.file.findMany({
        where: { hash },
        select: { filename: true, path: true, uploadedAt: true, size: true },
        orderBy: { uploadedAt: 'asc' },
      })

      console.log(`Hash: ${hash}`)
      console.log(`Duplicates: ${count}\n`)

      files.forEach((f, i) => {
        const date = f.uploadedAt.toLocaleString('pt-BR')
        const sizeMB = (f.size / 1024 / 1024).toFixed(2)
        console.log(
          `  ${i + 1}. ${f.filename} (${sizeMB} MB, ${date})`
        )
      })
      console.log()
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicates()
