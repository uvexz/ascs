import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch (error) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  try {

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const comments = await prisma.comment.findMany({
      include: {
        site: {
          select: {
            hostname: true,
            name: true
          }
        },
        parent: {
          select: {
            id: true,
            author: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    const total = await prisma.comment.count()

    return NextResponse.json({
      comments,
      total,
      hasMore: offset + limit < total
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 })
  }
}