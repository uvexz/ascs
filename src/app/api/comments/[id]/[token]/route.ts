import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyModerationToken, markTokenAsUsed } from '@/lib/moderation-tokens'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; token: string }> }
) {
  try {
    const { id: commentId, token } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'approve' 或 'delete'
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

    // 如果没有指定操作或未确认，显示操作选择页面
    if (!action || !confirmed) {
      return renderModerationPage(commentId, token, existingComment)
    }

    // 执行操作
    if (action === 'approve') {
      // 更新评论状态为已批准
      const updatedComment = await prisma.comment.update({
        where: { id: commentId },
        data: { status: 'APPROVED' },
      })

      // 标记token为已使用
      await markTokenAsUsed(token)

      // 返回成功页面
      return renderSuccessPage('审核通过', updatedComment, '该评论已成功通过审核并显示在网站上。')
    } else if (action === 'delete') {
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

      // 标记token为已使用
      await markTokenAsUsed(token)

      // 返回成功页面
      return renderSuccessPage('评论已删除', commentInfo, '该评论及其所有回复已成功删除。')
    } else {
      return renderErrorPage('无效的操作类型')
    }
  } catch (error) {
    console.error('Error moderating comment:', error)
    return renderErrorPage('处理审核时发生错误，请稍后重试或联系管理员。')
  }
}

interface CommentData {
  siteId?: string;
  pageId?: string;
  author: string;
  content: string;
  createdAt: Date;
}

function renderModerationPage(commentId: string, token: string, comment: CommentData) {
  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>评论审核</title>
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
          color: #3b82f6;
          margin-top: 0;
          text-align: center;
        }
        .comment-content {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          border-left: 4px solid #3b82f6;
          white-space: pre-wrap;
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
          justify-content: center;
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
          text-align: center;
        }
        .button-approve {
          background-color: #10b981;
          color: white;
        }
        .button-approve:hover {
          background-color: #059669;
        }
        .button-delete {
          background-color: #ef4444;
          color: white;
        }
        .button-delete:hover {
          background-color: #dc2626;
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
        .site-info {
          background: #eff6ff;
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📝 评论审核</h1>
        
        <div class="site-info">
          <strong>站点:</strong> ${comment.siteId || '未知站点'} | 
          <strong>页面:</strong> ${comment.pageId || '未知页面'}
        </div>
        
        <div class="meta">
          <strong>作者:</strong> ${comment.author} | 
          <strong>时间:</strong> ${new Date(comment.createdAt).toLocaleString('zh-CN')}
        </div>
        
        <div class="comment-content">
          ${comment.content}
        </div>
        
        <div class="warning">
          ⚠️ 请选择审核操作。此操作不可撤销。
        </div>
        
        <div class="button-group">
          <a href="?action=approve&confirmed=true" class="button button-approve">✅ 通过审核</a>
          <a href="?action=delete&confirmed=true" class="button button-delete">🗑️ 删除评论</a>
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

function renderSuccessPage(action: string, comment: CommentData, message: string) {
  const actionColor = action === '审核通过' ? '#10b981' : '#ef4444'
  const actionIcon = action === '审核通过' ? '✅' : '🗑️'
  
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
          color: ${actionColor};
          margin-top: 0;
        }
        .comment-content {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          border-left: 4px solid ${actionColor};
          white-space: pre-wrap;
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
        .site-info {
          background: #eff6ff;
          padding: 0.75rem 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${actionIcon} ${action}</h1>
        
        <div class="site-info">
          <strong>站点:</strong> ${comment.siteId || '未知站点'} | 
          <strong>页面:</strong> ${comment.pageId || '未知页面'}
        </div>
        
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