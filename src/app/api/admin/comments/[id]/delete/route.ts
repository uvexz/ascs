import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request)

    const { id: commentId } = await params

    // 检查评论是否存在
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!existingComment) {
      return NextResponse.json(
        { error: '评论不存在' },
        { status: 404 }
      )
    }

    // 保存评论信息用于显示
    const commentInfo = {
      author: existingComment.author,
      content: existingComment.content,
      createdAt: existingComment.createdAt,
    }

    // 删除评论及其所有回复（级联删除）
    await prisma.comment.delete({
      where: { id: commentId },
    })

    // 返回简单的HTML页面显示操作结果
    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>评论删除结果</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #ef4444;
            margin-top: 0;
          }
          .comment-content {
            background: #fef2f2;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            border-left: 4px solid #ef4444;
          }
          .meta {
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 1rem;
          }
          .back-link {
            display: inline-block;
            margin-top: 1rem;
            color: #3b82f6;
            text-decoration: none;
          }
          .back-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🗑️ 评论已删除</h1>
          <div class="meta">
            作者: ${commentInfo.author} | 
            时间: ${commentInfo.createdAt.toLocaleString('zh-CN')}
          </div>
          <div class="comment-content">
            ${commentInfo.content}
          </div>
          <p>该评论及其所有回复已成功删除。</p>
          <a href="/admin" class="back-link">返回管理后台</a>
        </div>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting comment:', error)
    
    // 返回错误页面
    const errorHtml = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>删除失败</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #ef4444;
            margin-top: 0;
          }
          .back-link {
            display: inline-block;
            margin-top: 1rem;
            color: #3b82f6;
            text-decoration: none;
          }
          .back-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌ 删除失败</h1>
          <p>删除评论时发生错误，请稍后重试或联系管理员。</p>
          <a href="/admin" class="back-link">返回管理后台</a>
        </div>
      </body>
      </html>
    `

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  }
}