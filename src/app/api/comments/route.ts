import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyNewComment } from '@/lib/notifications'
import { aiDetectionService } from '@/lib/ai-detection'
import { notifyPendingComment } from '@/lib/notifications'
import { createCorsResponse, handleOptions } from '@/lib/cors'
import { commentRateLimiter } from '@/lib/rate-limit'

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

    interface CommentWithReplies {
      id: string;
      content: string;
      author: string;
      email: string | null;
      website: string | null;
      pageId: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      siteId: string;
      parentId: string | null;
      replies: CommentWithReplies[];
    }

    // 递归获取所有评论及其回复（只包括已批准的评论）
    const buildCommentTree = async (parentId: string | null = null): Promise<CommentWithReplies[]> => {
      const comments = await prisma.comment.findMany({
        where: {
          siteId,
          pageId,
          parentId,
          status: 'APPROVED', // 只返回已批准的评论
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

    // 添加缓存头
    return createCorsResponse(comments, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return createCorsResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 获取客户端 IP 地址
 */
function getClientIP(request: NextRequest): string {
  // 尝试从各种头部获取 IP 地址
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  // 如果有 cf-connecting-ip（Cloudflare），优先使用
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // 如果有 x-real-ip，使用它
  if (realIP) {
    return realIP
  }
  
  // 如果有 x-forwarded-for，使用第一个 IP（可能是客户端真实IP）
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  // 最后使用直接连接的 IP
  return 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    // 获取客户端 IP 地址
    const ip = getClientIP(request)
    
    // 检查速率限制（异步）
    const isLimited = await commentRateLimiter.isRateLimited(ip)
    if (isLimited) {
      return createCorsResponse(
        { error: 'Too many requests. Please wait a few seconds before submitting another comment.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { siteId, pageId, author, content, email, website, parentId, captchaToken, captchaSolutions } = body

    if (!siteId || !pageId || !author || !content) {
      return createCorsResponse(
        { error: 'siteId, pageId, author, and content are required' },
        { status: 400 }
      )
    }

    // 验证 CAPTCHA
    if (!captchaToken || !captchaSolutions) {
      return createCorsResponse(
        { error: 'CAPTCHA verification is required' },
        { status: 400 }
      )
    }

    // 验证 CAPTCHA token（这里可以添加更严格的验证逻辑）
    // 由于 cap.js 的 token 验证通常在 redeem 阶段完成，这里做基本检查
    if (typeof captchaToken !== 'string' || !Array.isArray(captchaSolutions)) {
      return createCorsResponse(
        { error: 'Invalid CAPTCHA verification' },
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

    // 加载 AI 检测配置
    const aiEnabled = await aiDetectionService.loadConfig()
    
    if (aiEnabled) {
      // 检查是否为垃圾评论
      const isSpam = await aiDetectionService.isSpamComment(content, author, email, website)
      
      if (isSpam) {
        // 确认垃圾评论，直接拒绝
        return createCorsResponse(
          { error: '你的留言被 AI 识别为垃圾评论，请检查后再提交。Your comment was identified as spam by AI, please check before submitting.' },
          { status: 400 }
        )
      }
      
      // 检查是否需要人工审核
      const needsModeration = await aiDetectionService.needsModeration(content, author, email, website)
      
      if (needsModeration) {
        // 疑似垃圾评论，标记为待审核
        const comment = await prisma.comment.create({
          data: {
            siteId,
            pageId,
            author,
            content,
            email,
            website,
            parentId,
            status: 'PENDING',
          },
        })

        // 获取站点信息
        const siteInfo = await prisma.site.findUnique({
          where: { id: siteId },
        })

        // 发送待审核通知（异步执行，不阻塞响应）
        if (siteInfo) {
          notifyPendingComment(
            {
              id: comment.id,
              content: comment.content,
              author: comment.author,
              email: comment.email || undefined,
              pageId: comment.pageId,
              siteId: comment.siteId,
            },
            {
              hostname: siteInfo.hostname,
              name: siteInfo.name || undefined,
            }
          ).catch((error: unknown) => {
            console.error('Failed to send pending comment notification:', error)
          })
        }

        return createCorsResponse({
          ...comment,
          message: '您的评论需要管理员审核。Your comment requires administrator review.'
        }, { status: 201 })
      }
    }

    // 正常评论，直接创建并发布
    const comment = await prisma.comment.create({
      data: {
        siteId,
        pageId,
        author,
        content,
        email,
        website,
        parentId,
        status: 'APPROVED',
      },
    })

    // 发送通知（异步执行，不阻塞响应）
    if (site) {
      notifyNewComment(
        {
          id: comment.id,
          content: comment.content,
          author: comment.author,
          email: comment.email || undefined,
          pageId: comment.pageId,
          siteId: comment.siteId,
          parentId: comment.parentId || undefined,
        },
        {
          hostname: site.hostname,
          name: site.name || undefined,
        }
      ).catch((error: unknown) => {
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