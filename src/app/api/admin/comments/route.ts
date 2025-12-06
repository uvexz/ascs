import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || null // 获取状态参数

    // 构建查询条件
    const where = status ? { status: status as 'APPROVED' | 'PENDING' | 'REJECTED' } : {}

    const comments = await prisma.comment.findMany({
      where,
      include: {
        site: {
          select: {
            hostname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // 根据筛选条件计算总数
    const total = await prisma.comment.count({ where })

    return NextResponse.json({
      comments,
      total,
      limit,
      offset,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}