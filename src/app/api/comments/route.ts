import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyNewComment } from '@/lib/notifications'
import { createCorsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get('siteId')
    const pageId = searchParams.get('pageId')

    if (!siteId || !pageId) {
      return createCorsResponse(
        { error: 'siteId and pageId are required' },
        { status: 400 }
      )
    }

    // 递归获取所有评论及其回复
    const buildCommentTree = async (parentId: string | null = null): Promise<any[]> => {
      const comments = await prisma.comment.findMany({
        where: {
          siteId,
          pageId,
          parentId,
        },
        orderBy: parentId ? { createdAt: 'asc' } : { createdAt: 'desc' },
      })

      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await buildCommentTree(comment.id)
          return {
            ...comment,
            replies,
          }
        })
      )

      return commentsWithReplies
    }

    const comments = await buildCommentTree()

    return createCorsResponse(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return createCorsResponse(
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
      return createCorsResponse(
        { error: 'siteId, pageId, author, and content are required' },
        { status: 400 }
      )
    }

    // 验证站点是否存在
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    })

    if (!site) {
      return createCorsResponse(
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

    return createCorsResponse(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return createCorsResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}