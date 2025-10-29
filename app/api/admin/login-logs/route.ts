import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  // Only admins can access login logs
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || undefined
    const userEmail = searchParams.get('userEmail') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const limit = parseInt(searchParams.get('limit') || '1000', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build filter object
    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (userEmail) {
      where.userEmail = {
        contains: userEmail
      }
    }

    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) {
        where.timestamp.gte = new Date(startDate)
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate)
      }
    }

    // Get total count for pagination
    const total = await prisma.loginLog.count({ where })

    // Get login logs with filters, sorted by newest first
    const loginLogs = await prisma.loginLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit,
      skip: offset
    })

    return NextResponse.json({
      data: loginLogs,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching login logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch login logs' },
      { status: 500 }
    )
  }
}
