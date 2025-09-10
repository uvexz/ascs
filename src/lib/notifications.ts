import nodemailer from 'nodemailer'
import { prisma } from './prisma'
import crypto from 'crypto'

interface NotificationConfig {
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  smtpFrom?: string
  telegramBotToken?: string
  telegramChatId?: string
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'telegram_bot_token', 'telegram_chat_id']
      }
    }
  })

  const configMap = configs.reduce((acc, config) => {
    acc[config.key] = config.value
    return acc
  }, {} as Record<string, string>)

  return {
    smtpHost: configMap.smtp_host || process.env.SMTP_HOST,
    smtpPort: configMap.smtp_port ? parseInt(configMap.smtp_port) : (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined),
    smtpUser: configMap.smtp_user || process.env.SMTP_USER,
    smtpPass: configMap.smtp_pass || process.env.SMTP_PASS,
    smtpFrom: configMap.smtp_from || process.env.SMTP_FROM,
    telegramBotToken: configMap.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: configMap.telegram_chat_id || process.env.TELEGRAM_CHAT_ID,
  }
}

export async function sendEmailNotification(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const config = await getNotificationConfig()
    
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      console.log('SMTP not configured, skipping email notification')
      return false
    }

    const transporter = nodemailer.createTransporter({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    })

    await transporter.sendMail({
      from: config.smtpFrom || config.smtpUser,
      to,
      subject,
      html,
    })

    return true
  } catch (error) {
    console.error('Failed to send email:', error)
    return false
  }
}

export async function sendTelegramNotification(message: string): Promise<boolean> {
  try {
    const config = await getNotificationConfig()
    
    if (!config.telegramBotToken || !config.telegramChatId) {
      console.log('Telegram not configured, skipping notification')
      return false
    }

    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    return response.ok
  } catch (error) {
    console.error('Failed to send Telegram notification:', error)
    return false
  }
}

export async function subscribeToNotifications(
  email: string,
  siteId: string,
  pageId: string
): Promise<string | null> {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    
    await prisma.subscription.upsert({
      where: {
        email_pageId_siteId: {
          email,
          pageId,
          siteId,
        },
      },
      update: {
        isActive: true,
        token,
      },
      create: {
        email,
        pageId,
        siteId,
        token,
        isActive: true,
      },
    })

    return token
  } catch (error) {
    console.error('Failed to subscribe:', error)
    return null
  }
}

export async function unsubscribeFromNotifications(token: string): Promise<boolean> {
  try {
    await prisma.subscription.update({
      where: { token },
      data: { isActive: false },
    })
    return true
  } catch (error) {
    console.error('Failed to unsubscribe:', error)
    return false
  }
}

export async function notifyNewComment(
  comment: {
    id: string
    content: string
    author: string
    email?: string
    pageId: string
    siteId: string
  },
  site: {
    hostname: string
    name?: string
  }
) {
  // 发送管理员通知
  const adminMessage = `
🔔 新评论通知

站点: ${site.name || site.hostname}
页面: ${comment.pageId}
作者: ${comment.author}
内容: ${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}
  `.trim()

  await sendTelegramNotification(adminMessage)

  // 发送邮件订阅通知
  if (comment.email) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        siteId: comment.siteId,
        pageId: comment.pageId,
        isActive: true,
        email: {
          not: comment.email, // 不给自己发通知
        },
      },
    })

    for (const subscription of subscriptions) {
      const unsubscribeUrl = `${process.env.NEXTAUTH_URL}/api/unsubscribe?token=${subscription.token}`
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>新评论通知</h2>
          <p>在 <strong>${site.name || site.hostname}</strong> 的页面 <strong>${comment.pageId}</strong> 有新评论：</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>${comment.author}</strong> 说：</p>
            <p>${comment.content}</p>
          </div>
          
          <p><a href="${process.env.NEXTAUTH_URL}/?siteId=${comment.siteId}&pageId=${encodeURIComponent(comment.pageId)}" style="color: #2563eb;">查看完整讨论</a></p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            如果您不想再收到此页面的评论通知，请 <a href="${unsubscribeUrl}">点击这里退订</a>。
          </p>
        </div>
      `

      await sendEmailNotification(
        subscription.email,
        `新评论通知 - ${site.name || site.hostname}`,
        emailHtml
      )
    }

    // 为新评论者创建订阅
    await subscribeToNotifications(comment.email, comment.siteId, comment.pageId)
  }
}