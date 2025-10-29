import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'medlog',
      version: '0.1.0',
      database: 'connected'
    })
  } catch (error) {
    console.error('[HEALTH] Database connection failed:', error)
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'medlog',
      version: '0.1.0',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}