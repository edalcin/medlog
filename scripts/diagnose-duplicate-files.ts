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

async function diagnose() {
  console.log('Diagnóstico de Arquivos Duplicados\n')
  console.log('='.repeat(50))

  try {
    // Encontrar os dois arquivos
    const file1 = await prisma.file.findFirst({
      where: { path: '8c8a6579-8e16-4c8f-9b67-499d5ab192b5.pdf' },
    })

    const file2 = await prisma.file.findFirst({
      where: { path: '43517f79-39f6-4f98-831b-b9f078d5c985.pdf' },
    })

    if (!file1 || !file2) {
      console.log('❌ Arquivos não encontrados no banco de dados')
      return
    }

    console.log('\n📁 FILE 1:')
    console.log(`  Path: ${file1.path}`)
    console.log(`  Filename: ${file1.filename}`)
    console.log(`  Hash no BD: ${file1.hash || 'NULL'}`)
    console.log(`  Upload: ${file1.uploadedAt}`)

    console.log('\n📁 FILE 2:')
    console.log(`  Path: ${file2.path}`)
    console.log(`  Filename: ${file2.filename}`)
    console.log(`  Hash no BD: ${file2.hash || 'NULL'}`)
    console.log(`  Upload: ${file2.uploadedAt}`)

    console.log('\n' + '='.repeat(50))
    console.log('Calculando hashes dos arquivos no disco...\n')

    const fullPath1 = join(UPLOAD_DIR, file1.path)
    const fullPath2 = join(UPLOAD_DIR, file2.path)

    const hash1 = await calculateFileHashFromDisk(fullPath1)
    const hash2 = await calculateFileHashFromDisk(fullPath2)

    console.log(`Hash calculado arquivo 1: ${hash1}`)
    console.log(`Hash calculado arquivo 2: ${hash2}`)

    console.log('\n' + '='.repeat(50))
    console.log('ANÁLISE:\n')

    if (hash1 === hash2) {
      console.log(`✅ Os arquivos TÊM O MESMO CONTEÚDO`)
      console.log(`   SHA-256: ${hash1}`)
    } else {
      console.log(`❌ Os arquivos têm conteúdo DIFERENTE`)
      console.log(`   Arquivo 1: ${hash1}`)
      console.log(`   Arquivo 2: ${hash2}`)
      return
    }

    console.log('\n' + '='.repeat(50))
    console.log('PROBLEMA IDENTIFICADO:\n')

    if (!file1.hash && !file2.hash) {
      console.log('⚠️  AMBOS os arquivos têm hash = NULL no banco')
      console.log('\n   Razão: Foram enviados ANTES da implementação')
      console.log('   do sistema de hash (sem calcular hash)')
      console.log('\n   Por isso o sistema NÃO DETECTOU A DUPLICATA!')
      console.log('\n   Quando você enviou novamente, o sistema:')
      console.log('   1. Calculou o hash: ' + hash1)
      console.log('   2. Procurou: WHERE hash = "' + hash1 + '" AND userId = ?')
      console.log('   3. Não encontrou (porque os antigos têm hash = NULL)')
      console.log('   4. Aceitou como arquivo novo (ERRO!)')
    } else if (!file1.hash && file2.hash) {
      console.log('⚠️  Arquivo 1 tem hash = NULL (antigo)')
      console.log('✓ Arquivo 2 tem hash = ' + file2.hash)
    } else if (file1.hash && !file2.hash) {
      console.log('✓ Arquivo 1 tem hash = ' + file1.hash)
      console.log('⚠️  Arquivo 2 tem hash = NULL (antigo)')
    } else {
      console.log('✓ Ambos têm hashes:')
      console.log(`  Arquivo 1: ${file1.hash}`)
      console.log(`  Arquivo 2: ${file2.hash}`)
    }

    console.log('\n' + '='.repeat(50))
    console.log('SOLUÇÃO:\n')
    console.log('Opção 1: Executar backfill para calcular todos os hashes')
    console.log('  npm run backfill:hashes\n')

    console.log('Opção 2: Atualizar esses arquivos com seus hashes:')
    console.log(`  UPDATE files SET hash = '${hash1}' WHERE id = '${file1.id}';`)
    console.log(`  UPDATE files SET hash = '${hash2}' WHERE id = '${file2.id}';\n`)

    console.log('Opção 3: Deletar um dos duplicados')
    console.log(
      `  DELETE FROM files WHERE id = '${file1.id}'; -- ou ${file2.id}\n`
    )

    console.log('Após qualquer solução, futuros uploads duplicados')
    console.log('serão detectados corretamente! ✅')
  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnose()
