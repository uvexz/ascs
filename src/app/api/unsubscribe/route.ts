import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeFromNotifications } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const success = await unsubscribeFromNotifications(token)
    
    if (success) {
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>退订成功</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 400px; margin: 0 auto; }
            .success { color: #22c55e; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✓ 退订成功</h1>
            <p>您已成功退订评论通知。</p>
            <p>如果您改变主意，可以重新在相关页面留下评论来重新订阅。</p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error unsubscribing:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}