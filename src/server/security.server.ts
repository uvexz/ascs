import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { and, eq, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  instanceAdmins,
  members,
  rateLimits,
  session as sessions,
  sites,
  user as users,
} from '../db/schema'
import { auth } from '../lib/auth'
import { WIDGET_SESSION_AGENT, WIDGET_SESSION_TTL } from '../lib/validation'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
export function check(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, message)
}
export function digest(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  check(secret && secret.length >= 32, 503, '认证密钥未配置')
  return createHmac('sha256', secret).update(value).digest('hex')
}
export function secureEqual(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  )
}
export const baseOrigin = () =>
  new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000').origin

const EMAIL_CHANGE_TTL = 60 * 60 * 1000
type EmailChangeToken = {
  userId: string
  newEmail: string
  fromEmail: string
  expiresAt: number
}
export function emailChangeToken(
  userId: string,
  newEmail: string,
  fromEmail: string,
) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      newEmail,
      fromEmail,
      expiresAt: Date.now() + EMAIL_CHANGE_TTL,
    }),
  ).toString('base64url')
  return `${payload}.${digest(`email-change:${payload}`)}`
}
export function readEmailChangeToken(token: string): EmailChangeToken | null {
  const [payload = '', signature = ''] = token.split('.')
  if (!payload || !secureEqual(signature, digest(`email-change:${payload}`)))
    return null
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    )
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as EmailChangeToken).userId === 'string' &&
      typeof (parsed as EmailChangeToken).newEmail === 'string' &&
      typeof (parsed as EmailChangeToken).fromEmail === 'string' &&
      typeof (parsed as EmailChangeToken).expiresAt === 'number' &&
      (parsed as EmailChangeToken).expiresAt > Date.now()
    )
      return parsed as EmailChangeToken
  } catch {
    return null
  }
  return null
}
export function requireOrigin(request: Request) {
  check(request.headers.get('origin') === baseOrigin(), 403, '请求来源不受信任')
  check(
    request.headers.get('content-type')?.split(';')[0] === 'application/json',
    415,
    '请使用 application/json',
  )
}
export function ipHash(request: Request) {
  // Only enable a header when your ingress overwrites it and direct traffic is blocked.
  const header = process.env.TRUSTED_IP_HEADER
  return digest(
    `ip:${header ? request.headers.get(header)?.split(',')[0].trim() || 'unknown' : 'unknown'}`,
  )
}
export async function limit(key: string, max: number, windowMs = 60_000) {
  const now = Date.now()
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: now + windowMs })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN ${now + windowMs} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning()
  check(row.count <= max, 429, '请求过于频繁，请稍后重试')
}
export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  return /^bearer /i.test(header) ? header.slice(7).trim() : ''
}
export async function getSession(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  const person = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .then((rows) => rows.at(0))
  check(person && !person.disabled, 403, '账号已停用')
  return { ...session, user: person, widget: !!bearerToken(request) }
}
export async function requireSession(request: Request) {
  const session = await getSession(request)
  check(session, 401, '请先登录')
  check(!session.widget, 401, '请先登录')
  return session
}
export async function mintWidgetSession(userId: string) {
  const now = Date.now()
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.userAgent, WIDGET_SESSION_AGENT),
        lte(sessions.expiresAt, new Date(now)),
      ),
    )
  const context = await auth.$context
  const created = await context.internalAdapter.createSession(
    userId,
    false,
    {
      userAgent: WIDGET_SESSION_AGENT,
      expiresAt: new Date(now + WIDGET_SESSION_TTL),
    },
    true,
  )
  check(created, 500, '无法创建会话')
  return created
}
export async function revokeWidgetSession(token: string) {
  if (!token) return
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.token, token),
        eq(sessions.userAgent, WIDGET_SESSION_AGENT),
      ),
    )
}
export async function isAdmin(userId: string) {
  return !!(
    await db
      .select()
      .from(instanceAdmins)
      .where(eq(instanceAdmins.userId, userId))
      .limit(1)
  )[0]
}
export async function requireAdmin(request: Request) {
  const session = await requireSession(request)
  check(await isAdmin(session.user.id), 403, '只有实例管理员可以执行此操作')
  return session.user
}
export async function authorize(
  request: Request,
  siteId: string,
  ownerOnly = false,
) {
  const { user } = await requireSession(request)
  const [site] = await db
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)
  check(site, 404, '站点不存在')
  if (await isAdmin(user.id)) return { site, user, role: 'owner' as const }
  const member = await db
    .select()
    .from(members)
    .where(and(eq(members.siteId, siteId), eq(members.userId, user.id)))
    .limit(1)
    .then((rows) => rows.at(0))
  check(
    member && (!ownerOnly || member.role === 'owner'),
    403,
    '没有此站点的操作权限',
  )
  return { site, user, role: member.role }
}
export function challenge(siteId: string, pageKey: string) {
  const timestamp = Date.now().toString()
  return `${timestamp}.${digest(`challenge:${siteId}:${pageKey}:${timestamp}`)}`
}
export function verifyChallenge(
  token: string,
  siteId: string,
  pageKey: string,
) {
  const [timestamp, signature = ''] = token.split('.')
  const age = Date.now() - Number(timestamp)
  check(
    Number.isFinite(age) &&
      age >= 1500 &&
      age < 3_600_000 &&
      secureEqual(
        signature,
        digest(`challenge:${siteId}:${pageKey}:${timestamp}`),
      ),
    400,
    '请稍等片刻再提交，或刷新评论区后重试',
  )
}
export function voterIdentity(request: Request, userId?: string) {
  if (userId) return { voter: digest(`user:${userId}`), cookie: null }
  const raw = request.headers
    .get('cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('ascs_voter='))
    ?.slice(11)
  const [value = '', signature = ''] = (raw || '').split('.')
  const valid =
    /^[a-f0-9-]{36}$/.test(value) &&
    secureEqual(signature, digest(`voter:${value}`))
  const token = valid ? value : randomUUID()
  return {
    voter: digest(`voter:${token}`),
    cookie: valid
      ? null
      : `ascs_voter=${token}.${digest(`voter:${token}`)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${baseOrigin().startsWith('https:') ? '; Secure' : ''}`,
  }
}
