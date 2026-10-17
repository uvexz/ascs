import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { and, eq, like, lte, sql } from 'drizzle-orm'
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
/**
 * Resolve the client IP from the configured trusted header.
 *
 * Only a single valid address is accepted. This matches Better Auth's own
 * parser: a comma-separated chain is ambiguous behind append-style proxies
 * (the leftmost value is attacker-controlled), so it is rejected instead of
 * being trusted. Only enable a header when your ingress overwrites it and
 * direct traffic is blocked.
 */
export function clientIp(request: Request): string | null {
  const header = process.env.TRUSTED_IP_HEADER
  if (!header) return null
  const raw = request.headers.get(header)?.trim()
  if (!raw || raw.includes(',')) return null
  return isIP(raw) ? raw : null
}
export function ipHash(request: Request) {
  return digest(`ip:${clientIp(request) ?? 'unknown'}`)
}
/**
 * Drizzle's libSQL driver ignores `SQLiteTransactionConfig.behavior`, so
 * `db.transaction(fn, { behavior: 'immediate' })` stays deferred. A no-op
 * write as the first statement acquires the SQLite write lock explicitly,
 * giving the same serialization guarantee for check-then-act transactions.
 */
export async function lockWrite(executor: Pick<typeof db, 'run'>) {
  await executor.run(sql`UPDATE rate_limits SET count = count WHERE 0`)
}
/** Non-throwing counter used when exceeding the limit should degrade quietly. */
export async function allow(
  key: string,
  max: number,
  windowMs = 60_000,
): Promise<boolean> {
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
  return row.count <= max
}
export async function limit(key: string, max: number, windowMs = 60_000) {
  check(await allow(key, max, windowMs), 429, '请求过于频繁，请稍后重试')
}
export function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  return /^bearer /i.test(header) ? header.slice(7).trim() : ''
}
export async function getSession(request: Request) {
  // Bearer sessions are the short-lived widget credentials. Their lifetime is
  // fixed at mint time, so they must never be slid forward by Better Auth's
  // 7-day refresh window.
  const widget = !!bearerToken(request)
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableRefresh: widget },
  })
  if (!session) return null
  const person = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .then((rows) => rows.at(0))
  check(person && !person.disabled, 403, '账号已停用')
  const agent = session.session.userAgent
  const widgetSiteId =
    widget && agent?.startsWith(`${WIDGET_SESSION_AGENT}:`)
      ? agent.slice(WIDGET_SESSION_AGENT.length + 1)
      : null
  return { ...session, user: person, widget, widgetSiteId }
}
export async function requireSession(request: Request) {
  const session = await getSession(request)
  check(session, 401, '请先登录')
  check(!session.widget, 401, '请先登录')
  return session
}
export async function mintWidgetSession(userId: string, siteId: string) {
  const now = Date.now()
  // The user agent is the only place Better Auth stores extra session metadata
  // without a schema change. Encoding the site here keeps the bearer scoped to
  // the widget it was minted for; legacy `ascs-widget` tokens match no site and
  // are rejected until the visitor logs in again.
  const agent = `${WIDGET_SESSION_AGENT}:${siteId}`
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        like(sessions.userAgent, `${WIDGET_SESSION_AGENT}%`),
        lte(sessions.expiresAt, new Date(now)),
      ),
    )
  const context = await auth.$context
  const created = await context.internalAdapter.createSession(
    userId,
    false,
    {
      userAgent: agent,
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
        like(sessions.userAgent, `${WIDGET_SESSION_AGENT}%`),
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
