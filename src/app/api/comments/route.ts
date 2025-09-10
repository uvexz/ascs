import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyNewComment } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('siteId')
    const pageId = searchParams.get('pageId')

    if (!siteId || !pageId) {
      return NextResponse.json(
        { error: 'siteId and pageId are required' },
        { status: 400 }
      )
    }

    const comments = await prisma.comment.findMany({
      where: {
        siteId,
        pageId,
        parentId: null, // 只获取顶级评论
      },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { siteId, pageId, author, content, email, website, parentId } = body

    if (!siteId || !pageId || !author || !content) {
      return NextResponse.json(
        { error: 'siteId, pageId, author, and content are required' },
        { status: 400 }
      )
    }

    // 验证站点是否存在
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      )
    }

    const comment = await prisma.comment.create({
      data: {
        siteId,
        pageId,
        author,
        content,
        email,
        website,
        parentId,
      },
      include: {
        replies: true,
        site: true,
      },
    })

    // 发送通知（异步执行，不阻塞响应）
    if (comment.site) {
      notifyNewComment(
        {
          id: comment.id,
          content: comment.content,
          author: comment.author,
          email: comment.email || undefined,
          pageId: comment.pageId,
          siteId: comment.siteId,
        },
        {
          hostname: comment.site.hostname,
          name: comment.site.name || undefined,
        }
      ).catch(error => {
        console.error('Failed to send notification:', error)
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}