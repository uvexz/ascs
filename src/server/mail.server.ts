import { randomUUID } from 'node:crypto'
import { and, eq, isNull, lte, sql } from 'drizzle-orm'
import nodemailer from 'nodemailer'
import { db } from '../db'
import { mailQueue, rateLimits } from '../db/schema'
import { readSettings } from './settings.server'

async function mailTransport() {
  const { settings, saved } = await readSettings()
  if (!saved && process.env.SMTP_URL && process.env.MAIL_FROM)
    return {
      transport: nodemailer.createTransport(process.env.SMTP_URL),
      from: process.env.MAIL_FROM,
    }
  if (!settings.smtp.enabled) return null
  const smtp = settings.smtp
  return {
    transport: nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: !smtp.secure,
      ...(smtp.username
        ? { auth: { user: smtp.username, pass: smtp.password } }
        : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    }),
    from: smtp.from,
  }
}
export async function testMail(to: string) {
  const configured = await mailTransport()
  if (!configured) return false
  try {
    await configured.transport.verify()
    await configured.transport.sendMail({
      from: configured.from,
      to,
      subject: 'ASCS SMTP 测试',
      text: 'SMTP 配置测试成功。',
    })
    return true
  } finally {
    configured.transport.close()
  }
}

export async function enqueueMail(to: string, subject: string, body: string) {
  await db
    .insert(mailQueue)
    .values({ id: randomUUID(), to, subject, body, availableAt: Date.now() })
}

// Durable leases permit overlapping cron invocations; delivery is at least once.
export async function flushMail() {
  const configured = await mailTransport()
  if (!configured) return { sent: 0, configured: false }
  const { transport, from } = configured
  const due = await db
    .select()
    .from(mailQueue)
    .where(
      and(
        isNull(mailQueue.sentAt),
        lte(mailQueue.availableAt, Date.now()),
        lte(mailQueue.leaseUntil, Date.now()),
        lte(mailQueue.attempts, 4),
      ),
    )
    .limit(20)
  let sent = 0
  for (const mail of due) {
    const token = randomUUID()
    const claimed = await db
      .update(mailQueue)
      .set({
        leaseUntil: Date.now() + 300_000,
        leaseToken: token,
        attempts: sql`${mailQueue.attempts} + 1`,
      })
      .where(
        and(
          eq(mailQueue.id, mail.id),
          lte(mailQueue.attempts, 4),
          lte(mailQueue.availableAt, Date.now()),
          lte(mailQueue.leaseUntil, Date.now()),
          isNull(mailQueue.sentAt),
        ),
      )
      .returning({ id: mailQueue.id })
    if (!claimed.length) continue
    try {
      await transport.sendMail({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.body,
        messageId: `<${mail.id}@ascs.local>`,
      })
      await db
        .update(mailQueue)
        .set({ sentAt: Date.now(), leaseUntil: 0, lastError: null })
        .where(and(eq(mailQueue.id, mail.id), eq(mailQueue.leaseToken, token)))
      sent++
    } catch {
      await db
        .update(mailQueue)
        .set({
          lastError: 'SMTP delivery failed',
          leaseUntil: 0,
          availableAt: Date.now() + 60_000 * 2 ** mail.attempts,
        })
        .where(and(eq(mailQueue.id, mail.id), eq(mailQueue.leaseToken, token)))
    }
  }
  transport.close()
  await db
    .delete(rateLimits)
    .where(lte(rateLimits.resetAt, Date.now() - 86_400_000))
  return { sent, configured: true }
}
