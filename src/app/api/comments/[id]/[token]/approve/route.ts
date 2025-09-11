import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyModerationToken, markTokenAsUsed } from '@/lib/moderation-tokens'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; token: string } }
) {
  try {
    const commentId = params.id
    const token = params.token
    const { searchParams } = new URL(request.url)
    const confirmed = searchParams.get('confirmed') === 'true'

    // 验证token
    const verification = await verifyModerationToken(token)
    
    if (!verification.isValid) {
      return renderErrorPage(verification.error || '无效的审核链接')
    }

    // 检查评论是否存在
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
    })

    if (!existingComment) {
      return renderErrorPage('评论不存在')
    }

    // 检查token是否属于该评论
    if (verification.tokenData?.commentId !== commentId) {
      return renderErrorPage('审核链接与评论不匹配')
    }

    // 如果没有确认，显示确认页面
    if (!confirmed) {
      return renderConfirmationPage(commentId, token, existingComment, 'approve')
    }

    // 更新评论状态为已批准
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { status: 'APPROVED' },
    })

    // 标记token为已使用
    await markTokenAsUsed(token)

    // 返回成功页面
    return renderSuccessPage('审核通过', updatedComment, '该评论已成功通过审核并显示在网站上。')
  } catch (error) {
    console.error('Error approving comment:', error)
    return renderErrorPage('处理审核时发生错误，请稍后重试或联系管理员。')
  }
}

function renderSuccessPage(action: string, comment: any, message: string) {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>评论审核结果</title>
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
          color: #10b981;
          margin-top: 0;
        }
        .comment-content {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          border-left: 4px solid #10b981;
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
        .token-info {
          background: #eff6ff;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-size: 0.875rem;
          color: #1e40af;
          margin-top: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ ${action}</h1>
        <div class="meta">
          作者: ${comment.author} | 
          时间: ${new Date(comment.createdAt).toLocaleString('zh-CN')}
        </div>
        <div class="comment-content">
          ${comment.content}
        </div>
        <p>${message}</p>
        <div class="token-info">
          此审核链接已使用，无法再次使用。
        </div>
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
}

function renderConfirmationPage(commentId: string, token: string, comment: any, action: string) {
  const actionText = action === 'approve' ? '通过审核' : '删除评论'
  const actionColor = action === 'approve' ? '#10b981' : '#ef4444'
  const actionIcon = action === 'approve' ? '✅' : '🗑️'
  
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>确认操作</title>
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
          color: ${actionColor};
          margin-top: 0;
        }
        .comment-content {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          border-left: 4px solid ${actionColor};
        }
        .meta {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 1rem;
        }
        .button-group {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }
        .button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          font-weight: 500;
          transition: all 0.2s;
        }
        .button-confirm {
          background-color: ${actionColor};
          color: white;
        }
        .button-confirm:hover {
          background-color: ${actionColor}dd;
        }
        .button-cancel {
          background-color: #6b7280;
          color: white;
        }
        .button-cancel:hover {
          background-color: #4b5563;
        }
        .warning {
          background: #fef3c7;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          border-left: 4px solid #f59e0b;
          font-size: 0.875rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${actionIcon} 确认${actionText}</h1>
        <div class="meta">
          作者: ${comment.author} |
          时间: ${new Date(comment.createdAt).toLocaleString('zh-CN')}
        </div>
        <div class="comment-content">
          ${comment.content}
        </div>
        <div class="warning">
          ⚠️ 请确认您要${actionText}此评论。此操作不可撤销。
        </div>
        <div class="button-group">
          <a href="?confirmed=true" class="button button-confirm">确认${actionText}</a>
          <a href="/admin" class="button button-cancel">取消</a>
        </div>
      </div>
    </body>
    </html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

function renderErrorPage(errorMessage: string) {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>审核失败</title>
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
        .error-message {
          background: #fef2f2;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          border-left: 4px solid #ef4444;
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
        <h1>❌ 审核失败</h1>
        <div class="error-message">
          ${errorMessage}
        </div>
        <p>如果问题持续存在，请联系管理员。</p>
        <a href="/admin" class="back-link">返回管理后台</a>
      </div>
    </body>
    </html>
  `

  return new NextResponse(html, {
    status: 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}