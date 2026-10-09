import { randomUUID } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import {
  bans,
  comments,
  likes,
  members,
  sites,
  user,
  mailQueue,
  auditLogs,
} from '../db/schema'
import {
  banInput,
  commentInput,
  id,
  listInput,
  memberInput,
  moderationInput,
  PAGE_SIZE,
  pageInput,
  siteInput,
  siteSettings,
} from '../lib/validation'
import {
  authorize,
  baseOrigin,
  challenge,
  check,
  digest,
  getSession,
  HttpError,
  ipHash,
  isAdmin,
  limit,
  requireOrigin,
  requireSession,
  secureEqual,
  verifyChallenge,
  voterIdentity,
} from './security.server'
import { flushMail } from './mail.server'
import { handleAdmin } from './admin.server'
import { publicSettings } from './settings.server'
import { body, params, json } from './http.server'
import {
  confirmEmailChange,
  getProfile,
  getProfileAccounts,
  requestEmailChange,
  updateProfile,
} from './profile.server'

async function publicContext(input: z.infer<typeof pageInput>) {
  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.id, input.siteId))
    .limit(1)
    .then((rows) => rows.at(0))
  check(site?.verifiedAt && site.enabled, 404, '站点未验证、已停用或不存在')
  const url = new URL(input.pageUrl)
  check(
    ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.origin === site.origin,
    403,
    '文章地址不属于此站点',
  )
  url.hash = ''
  return { site, pageUrl: url.href, pageKey: input.pageKey || url.href }
}
const counts = (siteId: string) =>
  db
    .select({ status: comments.status, count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.siteId, siteId))
    .groupBy(comments.status)

async function listComments(request: Request) {
  const input = listInput.parse(params(request))
  const { site, pageKey } = await publicContext(input)
  if (input.parentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.id, input.parentId),
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          inArray(comments.status, ['approved', 'deleted']),
        ),
      )
      .limit(1)
    check(parent, 404, '回复不存在')
  }
  const where = and(
    eq(comments.siteId, site.id),
    eq(comments.pageKey, pageKey),
    input.parentId
      ? eq(comments.parentId, input.parentId)
      : isNull(comments.parentId),
    inArray(comments.status, ['approved', 'deleted']),
  )
  const [threadTotal] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(where)
  const totalPages = Math.max(1, Math.ceil(threadTotal.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const session = await getSession(request)
  const identity = voterIdentity(request, session?.user.id)
  const likeCount = sql<number>`(select count(*) from likes where likes.comment_id = "comments"."id")`
  const liked = sql<number>`exists(select 1 from likes where likes.comment_id = "comments"."id" and likes.voter = ${identity.voter})`
  const replyCount = sql<number>`(select count(*) from comments as replies where replies.parent_id = "comments"."id" and replies.site_id = "comments"."site_id" and replies.page_key = "comments"."page_key" and replies.status in ('approved', 'deleted'))`
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      author: sql<string>`case when ${comments.status} = 'deleted' then '已删除' else coalesce(${user.name}, ${comments.author}) end`,
      image: sql<
        string | null
      >`case when ${comments.status} = 'deleted' then null else ${user.image} end`,
      website: sql<
        string | null
      >`case when ${comments.status} = 'deleted' then null else ${user.website} end`,
      body: sql<string>`case when ${comments.status} = 'deleted' then '' else ${comments.body} end`,
      status: comments.status,
      depth: comments.depth,
      createdAt: comments.createdAt,
      likes: likeCount,
      liked,
      replies: replyCount,
    })
    .from(comments)
    .leftJoin(user, eq(user.id, comments.userId))
    .where(where)
    .orderBy(
      ...(input.sort === 'popular'
        ? [desc(likeCount), desc(comments.createdAt), asc(comments.id)]
        : input.sort === 'oldest'
          ? [asc(comments.createdAt), asc(comments.id)]
          : [desc(comments.createdAt), asc(comments.id)]),
    )
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(
      and(
        eq(comments.siteId, site.id),
        eq(comments.pageKey, pageKey),
        eq(comments.status, 'approved'),
      ),
    )
  return {
    items: rows.map((row) => ({ ...row, liked: !!row.liked })),
    hasMore: page < totalPages,
    total: total.count,
    threadTotal: threadTotal.count,
    totalPages,
    page,
    identityAvailable: !identity.cookie,
  }
}
export type CommentList = Awaited<ReturnType<typeof listComments>>

async function locateComment(request: Request) {
  const input = listInput.extend({ commentId: id }).parse(params(request))
  const { site, pageKey } = await publicContext(input)
  const path: Array<{ id: string; page: number }> = []
  let commentId: string | null = input.commentId
  while (commentId && path.length < 5) {
    const [node] = await db
      .select({ id: comments.id, parentId: comments.parentId })
      .from(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          inArray(comments.status, ['approved', 'deleted']),
        ),
      )
      .limit(1)
    check(node, 404, '评论或其所属讨论暂不可见，请稍后重试')
    const likeCount = sql<number>`(select count(*) from likes where likes.comment_id = "comments"."id")`
    const order =
      input.sort === 'popular'
        ? sql`${likeCount} desc, ${comments.createdAt} desc, ${comments.id} asc`
        : input.sort === 'oldest'
          ? sql`${comments.createdAt} asc, ${comments.id} asc`
          : sql`${comments.createdAt} desc, ${comments.id} asc`
    const ranked = db
      .select({
        id: comments.id,
        position: sql<number>`row_number() over (order by ${order})`.as(
          'position',
        ),
      })
      .from(comments)
      .where(
        and(
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          node.parentId
            ? eq(comments.parentId, node.parentId)
            : isNull(comments.parentId),
          inArray(comments.status, ['approved', 'deleted']),
        ),
      )
      .as('ranked')
    const [rank] = await db
      .select({ position: ranked.position })
      .from(ranked)
      .where(eq(ranked.id, node.id))
    check(rank, 404, '评论暂不可见，请稍后重试')
    path.unshift({ id: node.id, page: Math.ceil(rank.position / PAGE_SIZE) })
    commentId = node.parentId
  }
  check(!commentId, 400, '讨论层级超出范围')
  return { id: input.commentId, path }
}
export type CommentLocation = Awaited<ReturnType<typeof locateComment>>

async function createComment(request: Request) {
  const input = commentInput.parse(await body(request))
  const { site, pageKey, pageUrl } = await publicContext(input)
  const ip = ipHash(request)
  await limit(`comment:${site.id}:${ip}`, 5, 60_000)
  await limit(`comment-global:${ip}`, 40, 3_600_000)
  verifyChallenge(input.challenge, site.id, pageKey)
  check(!input.website, 400, '评论未通过垃圾检测')
  const session = await getSession(request)
  check(site.allowAnonymous || session, 401, '此站点需要登录后评论')
  check(session || (input.author && input.email), 400, '匿名评论需要昵称和邮箱')
  const emailHash = digest(
    `email:${(session?.user.email || input.email!).toLowerCase()}`,
  )
  const identities = [
    and(eq(bans.kind, 'email'), eq(bans.value, emailHash)),
    and(eq(bans.kind, 'ip'), eq(bans.value, ip)),
    ...(session
      ? [and(eq(bans.kind, 'user'), eq(bans.value, session.user.id))]
      : []),
  ]
  const banned = await db
    .select()
    .from(bans)
    .where(and(eq(bans.siteId, site.id), or(...identities)))
    .limit(1)
  check(!banned.length, 403, '你已被此站点封禁')
  let depth = 0
  if (input.parentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.id, input.parentId),
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          eq(comments.status, 'approved'),
        ),
      )
      .limit(1)
    check(parent, 400, '只能回复同站点、同文章的已发布评论')
    depth = parent.depth + 1
    check(depth <= 4, 400, '回复层级已达上限')
  }
  const duplicate = await db
    .select({ id: comments.id })
    .from(comments)
    .where(
      and(
        eq(comments.siteId, site.id),
        eq(comments.pageKey, pageKey),
        eq(comments.ipHash, ip),
        eq(comments.body, input.body),
        sql`${comments.createdAt} > ${Date.now() - 300_000}`,
      ),
    )
    .limit(1)
  check(!duplicate.length, 409, '请勿重复提交相同评论')
  const words = site.blockedWords
    .split(/\r?\n/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  const spamReason = words.some((word) =>
    input.body.toLowerCase().includes(word),
  )
    ? 'blocked-word'
    : (input.body.match(/https?:\/\//gi)?.length || 0) > 3
      ? 'too-many-links'
      : null
  const status = spamReason
    ? 'spam'
    : site.moderation === 'all' || (site.moderation === 'anonymous' && !session)
      ? 'pending'
      : 'approved'
  const commentId = randomUUID()
  const author = session?.user.name || input.author!
  // Comment and its notification are committed atomically.
  await db.transaction(async (tx) => {
    await tx.insert(comments).values({
      id: commentId,
      siteId: site.id,
      pageKey,
      pageUrl,
      parentId: input.parentId || null,
      depth,
      userId: session?.user.id || null,
      author,
      emailHash,
      ipHash: ip,
      body: input.body,
      status,
      spamReason,
      createdAt: Date.now(),
    })
    if (site.notificationEmail && status !== 'spam')
      await tx.insert(mailQueue).values({
        id: randomUUID(),
        to: site.notificationEmail,
        subject: `[ASCS] ${site.name} 有新评论`,
        body: `${author}：\n${input.body}\n\n文章：${pageUrl}\n状态：${status}\n管理：${baseOrigin()}/`,
        availableAt: Date.now(),
      })
  })
  return json({ id: commentId, status }, 201)
}

async function toggleLike(request: Request) {
  const input = pageInput.extend({ commentId: id }).parse(await body(request))
  const { site, pageKey } = await publicContext(input)
  const [comment] = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.id, input.commentId),
        eq(comments.siteId, site.id),
        eq(comments.pageKey, pageKey),
        eq(comments.status, 'approved'),
      ),
    )
    .limit(1)
  check(comment, 404, '评论不存在')
  await limit(`like:${site.id}:${ipHash(request)}`, 60)
  const session = await getSession(request)
  const identity = voterIdentity(request, session?.user.id)
  const inserted = await db
    .insert(likes)
    .values({ commentId: comment.id, voter: identity.voter })
    .onConflictDoNothing()
    .returning()
  if (!inserted.length)
    await db
      .delete(likes)
      .where(
        and(eq(likes.commentId, comment.id), eq(likes.voter, identity.voter)),
      )
  return json(
    { liked: !!inserted.length },
    200,
    identity.cookie ? { 'Set-Cookie': identity.cookie } : {},
  )
}

async function dashboard(request: Request) {
  const session = await requireSession(request)
  const admin = await isAdmin(session.user.id)
  const selected = new URL(request.url).searchParams.get('site')
  let accessible: Array<
    typeof sites.$inferSelect & { role?: 'owner' | 'moderator' }
  >
  if (admin) {
    const rows = await db
      .select()
      .from(sites)
      .orderBy(desc(sites.createdAt))
      .limit(PAGE_SIZE)
    if (selected && !rows.some((site) => site.id === selected)) {
      const extra = await db
        .select()
        .from(sites)
        .where(eq(sites.id, selected))
        .limit(1)
        .then((found) => found.at(0))
      if (extra) rows.unshift(extra)
    }
    accessible = rows
  } else {
    accessible = await db
      .select({ site: sites, role: members.role })
      .from(members)
      .innerJoin(sites, eq(sites.id, members.siteId))
      .where(eq(members.userId, session.user.id))
      .then((rows) => rows.map((row) => ({ ...row.site, role: row.role })))
  }
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    admin,
    siteLimit: session.user.siteLimit,
    ownedSites: accessible.filter(
      (site) => 'role' in site && site.role === 'owner',
    ).length,
    canCreateSite:
      admin ||
      accessible.filter((site) => 'role' in site && site.role === 'owner')
        .length < session.user.siteLimit,
    instance: await publicSettings(),
    sites: accessible.map((site) => ({
      ...site,
      role: 'role' in site ? site.role : ('owner' as const),
    })),
  }
}
export type Dashboard = Awaited<ReturnType<typeof dashboard>>

async function listSites(request: Request) {
  const session = await requireSession(request)
  const admin = await isAdmin(session.user.id)
  const input = z
    .object({
      q: z.string().trim().max(100).default(''),
      page: z.coerce.number().int().min(1).max(10000).default(1),
    })
    .parse(params(request))
  const needle = input.q.toLowerCase()
  if (!admin) {
    const rows = await db
      .select({ site: sites, role: members.role })
      .from(members)
      .innerJoin(sites, eq(sites.id, members.siteId))
      .where(eq(members.userId, session.user.id))
      .then((list) =>
        list
          .map((row) => ({
            id: row.site.id,
            name: row.site.name,
            origin: row.site.origin,
            role: row.role,
          }))
          .filter(
            (site) =>
              !needle ||
              site.name.toLowerCase().includes(needle) ||
              site.origin.toLowerCase().includes(needle),
          ),
      )
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
    const page = Math.min(input.page, totalPages)
    return {
      items: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: rows.length,
      totalPages,
      page,
      hasMore: page < totalPages,
    }
  }
  const where = input.q
    ? or(
        sql`lower(${sites.name}) like ${`%${needle}%`}`,
        sql`lower(${sites.origin}) like ${`%${needle}%`}`,
      )
    : undefined
  const [count] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sites)
    .where(where)
  const totalPages = Math.max(1, Math.ceil(count.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const items = await db
    .select({ id: sites.id, name: sites.name, origin: sites.origin })
    .from(sites)
    .where(where)
    .orderBy(desc(sites.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .then((list) => list.map((site) => ({ ...site, role: 'owner' as const })))
  return {
    items,
    total: count.count,
    totalPages,
    page,
    hasMore: page < totalPages,
  }
}
export type SiteList = Awaited<ReturnType<typeof listSites>>

async function adminComments(request: Request, siteId: string) {
  await authorize(request, siteId)
  const input = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      status: z
        .enum(['all', 'pending', 'approved', 'spam', 'deleted'])
        .default('pending'),
    })
    .parse(params(request))
  const where = and(
    eq(comments.siteId, siteId),
    input.status === 'all' ? undefined : eq(comments.status, input.status),
  )
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(where)
  const totalPages = Math.max(1, Math.ceil(total.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const parentAuthor = sql<
    string | null
  >`(select p.author from comments p where p.id = "comments"."parent_id" and p.site_id = "comments"."site_id" and p.page_key = "comments"."page_key")`
  const parentBody = sql<
    string | null
  >`(select substr(p.body, 1, 300) from comments p where p.id = "comments"."parent_id" and p.site_id = "comments"."site_id" and p.page_key = "comments"."page_key")`
  const items = await db
    .select({
      id: comments.id,
      author: sql<string>`case when ${comments.status} = 'deleted' then '已删除' else coalesce(${user.name}, ${comments.author}) end`,
      image: sql<
        string | null
      >`case when ${comments.status} = 'deleted' then null else ${user.image} end`,
      body: comments.body,
      pageUrl: comments.pageUrl,
      pageKey: comments.pageKey,
      parentId: comments.parentId,
      parentAuthor,
      parentBody,
      status: comments.status,
      userId: comments.userId,
      hasEmail: sql<number>`${comments.emailHash} is not null`,
      hasIp: sql<number>`${!!process.env.TRUSTED_IP_HEADER} and ${comments.ipHash} != ${digest('ip:unknown')} and ${comments.ipHash} != ''`,
      spamReason: comments.spamReason,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(user, eq(user.id, comments.userId))
    .where(where)
    .orderBy(desc(comments.createdAt), asc(comments.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  return {
    items,
    hasMore: page < totalPages,
    total: total.count,
    totalPages,
    page,
  }
}
export type AdminComments = Awaited<ReturnType<typeof adminComments>>

async function manageSite(request: Request, siteId: string, action?: string) {
  id.parse(siteId)
  const { site, role } = await authorize(
    request,
    siteId,
    ['verify', 'members', 'settings'].includes(action || '') ||
      request.method === 'PATCH',
  )
  if (!action && request.method === 'GET') {
    const [stats, banned, team, daily] = await Promise.all([
      counts(siteId),
      db
        .select({
          id: bans.id,
          kind: bans.kind,
          createdAt: bans.createdAt,
          target: sql<
            string | null
          >`(select c.author from comments c where c.site_id = ${bans.siteId} and c.status != 'deleted' and ((${bans.kind} = 'user' and c.user_id = ${bans.value}) or (${bans.kind} = 'email' and c.email_hash = ${bans.value}) or (${bans.kind} = 'ip' and c.ip_hash = ${bans.value})) order by c.created_at desc limit 1)`,
        })
        .from(bans)
        .where(eq(bans.siteId, siteId))
        .orderBy(desc(bans.createdAt))
        .limit(100),
      role === 'owner'
        ? db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              role: members.role,
            })
            .from(members)
            .innerJoin(user, eq(user.id, members.userId))
            .where(eq(members.siteId, siteId))
        : Promise.resolve([]),
      db
        .select({
          day: sql<string>`date(${comments.createdAt}/1000, 'unixepoch')`,
          count: sql<number>`count(*)`,
        })
        .from(comments)
        .where(
          and(
            eq(comments.siteId, siteId),
            ne(comments.status, 'deleted'),
            sql`${comments.createdAt} >= ${Date.now() - 7 * 86_400_000}`,
          ),
        )
        .groupBy(sql`date(${comments.createdAt}/1000, 'unixepoch')`),
    ])
    return json({
      site,
      role,
      stats,
      bans: banned,
      members: team,
      daily,
      canBanIp: !!process.env.TRUSTED_IP_HEADER,
    })
  }
  if (!action && request.method === 'PATCH') {
    await db
      .update(sites)
      .set(siteSettings.parse(await body(request)))
      .where(eq(sites.id, siteId))
    return json({ ok: true })
  }
  if (action === 'verify' && request.method === 'POST') {
    await limit(`verify:${siteId}`, 5)
    const hostname = new URL(site.origin).hostname
    let valid = false
    if (
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname) &&
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_LOCALHOST_SITE === 'true'
    )
      valid = true
    else {
      try {
        const records = await resolveTxt(`_ascs.${hostname}`)
        valid = records.some(
          (record) =>
            record.join('') === `ascs-verification=${site.verificationToken}`,
        )
      } catch {
        /* Return a useful error without exposing DNS internals. */
      }
    }
    check(valid, 400, '未找到匹配的 DNS TXT 记录，请检查配置并等待 DNS 生效')
    await db
      .update(sites)
      .set({ verifiedAt: Date.now() })
      .where(eq(sites.id, siteId))
    return json({ ok: true })
  }
  if (action === 'comments' && request.method === 'GET')
    return json(await adminComments(request, siteId))
  if (action === 'comments' && request.method === 'POST') {
    const input = moderationInput.parse(await body(request))
    const changed = await db
      .update(comments)
      .set(
        input.status === 'deleted'
          ? {
              status: 'deleted',
              body: '',
              author: '已删除',
              userId: null,
              emailHash: null,
              ipHash: '',
              spamReason: null,
            }
          : { status: input.status },
      )
      .where(
        and(
          eq(comments.id, input.commentId),
          eq(comments.siteId, siteId),
          ne(comments.status, 'deleted'),
        ),
      )
      .returning({ id: comments.id })
    check(changed.length, 404, '评论不存在或已删除')
    return json({ ok: true })
  }
  if (action === 'bans' && request.method === 'POST') {
    const input = banInput.parse(await body(request))
    const comment = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, input.commentId), eq(comments.siteId, siteId)))
      .limit(1)
      .then((rows) => rows.at(0))
    check(comment && comment.status !== 'deleted', 404, '评论不存在')
    const value =
      input.kind === 'user'
        ? comment.userId
        : input.kind === 'email'
          ? comment.emailHash
          : comment.ipHash
    check(value, 400, '评论没有此身份信息')
    if (input.kind === 'ip')
      check(
        !!process.env.TRUSTED_IP_HEADER && value !== digest('ip:unknown'),
        400,
        '无法识别独立 IP，请使用账号或邮箱封禁',
      )
    await db
      .insert(bans)
      .values({
        id: randomUUID(),
        siteId,
        kind: input.kind,
        value,
        createdAt: Date.now(),
      })
      .onConflictDoNothing()
    return json({ ok: true })
  }
  if (action === 'bans' && request.method === 'DELETE') {
    const input = z.object({ banId: id }).parse(await body(request))
    await db
      .delete(bans)
      .where(and(eq(bans.id, input.banId), eq(bans.siteId, siteId)))
    return json({ ok: true })
  }
  if (action === 'members' && request.method === 'POST') {
    const input = memberInput.parse(await body(request))
    check(
      input.role !== 'owner' || input.confirmOwner,
      400,
      '请确认所有者权限及当前后台无法移除所有者的限制',
    )
    const [person] = await db
      .select()
      .from(user)
      .where(eq(user.email, input.email.toLowerCase()))
      .limit(1)
    check(person, 400, '请先让该用户注册 ASCS 账号')
    const existing = await db
      .select()
      .from(members)
      .where(and(eq(members.siteId, siteId), eq(members.userId, person.id)))
      .limit(1)
    check(!existing.length, 409, '用户已是成员；修改角色请先移除')
    if (input.role === 'owner') {
      check(!person.disabled, 400, '该用户已停用')
      if (!(await isAdmin(person.id))) {
        const [owned] = await db
          .select({ count: sql<number>`count(*)` })
          .from(members)
          .where(and(eq(members.userId, person.id), eq(members.role, 'owner')))
        check(
          owned.count < person.siteLimit,
          400,
          '该用户站点额度不足，请先调整额度',
        )
      }
    }
    await db
      .insert(members)
      .values({ siteId, userId: person.id, role: input.role })
    return json({ ok: true })
  }
  if (action === 'members' && request.method === 'DELETE') {
    const input = z.object({ userId: id }).parse(await body(request))
    // Owners are permanent unless an instance admin uses a maintenance migration.
    const removed = await db
      .delete(members)
      .where(
        and(
          eq(members.siteId, siteId),
          eq(members.userId, input.userId),
          eq(members.role, 'moderator'),
        ),
      )
      .returning()
    check(removed.length, 400, '只能移除审核员，不能移除站点所有者')
    return json({ ok: true })
  }
  throw new HttpError(404, '接口不存在')
}
export type SiteDetail = {
  site: typeof sites.$inferSelect
  role: 'owner' | 'moderator'
  stats: { status: typeof comments.$inferSelect.status; count: number }[]
  bans: {
    id: string
    kind: 'user' | 'email' | 'ip'
    createdAt: number
    target: string | null
  }[]
  canBanIp: boolean
  members: {
    id: string
    name: string
    email: string
    role: 'owner' | 'moderator'
  }[]
  daily: { day: string; count: number }[]
}

export async function handleApi(request: Request) {
  try {
    const path = new URL(request.url).pathname
      .replace(/^\/api\/v1\/?/, '')
      .split('/')
      .filter(Boolean)
    if (
      path[0] === 'cron' &&
      path[1] === 'mail' &&
      ['GET', 'POST'].includes(request.method)
    ) {
      const expected = process.env.CRON_SECRET
      check(
        expected &&
          expected.length >= 32 &&
          secureEqual(
            request.headers.get('authorization') || '',
            `Bearer ${expected}`,
          ),
        401,
        '未授权',
      )
      return json(await flushMail())
    }
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method))
      throw new HttpError(405, '不支持此请求方法')
    if (request.method !== 'GET') requireOrigin(request)
    await limit(`api:${ipHash(request)}`, 300)
    if (path[0] === 'admin') return await handleAdmin(request, path.slice(1))
    if (path[0] === 'instance-config' && request.method === 'GET')
      return json(await publicSettings())
    if (path[0] === 'config' && request.method === 'GET') {
      const context = await publicContext(pageInput.parse(params(request)))
      const identity = voterIdentity(
        request,
        (await getSession(request))?.user.id,
      )
      return json(
        {
          name: context.site.name,
          allowAnonymous: context.site.allowAnonymous,
          theme: context.site.theme,
          challenge: challenge(context.site.id, context.pageKey),
        },
        200,
        identity.cookie ? { 'Set-Cookie': identity.cookie } : {},
      )
    }
    if (
      path[0] === 'comments' &&
      path[1] === 'locate' &&
      request.method === 'GET'
    )
      return json(await locateComment(request))
    if (path[0] === 'comments') {
      if (request.method === 'GET') return json(await listComments(request))
      if (request.method === 'POST') return await createComment(request)
    }
    if (path[0] === 'likes' && request.method === 'POST')
      return await toggleLike(request)
    if (path.length === 1 && path[0] === 'profile') {
      if (request.method === 'GET') return json(await getProfile(request))
      if (request.method === 'PATCH') return json(await updateProfile(request))
      throw new HttpError(405, '不支持此请求方法')
    }
    if (
      path[0] === 'profile' &&
      path[1] === 'accounts' &&
      request.method === 'GET'
    )
      return json(await getProfileAccounts(request))
    if (path[0] === 'profile' && path[1] === 'email') {
      if (path.length === 2 && request.method === 'POST')
        return json(await requestEmailChange(request))
      if (
        path.length === 3 &&
        path[2] === 'confirm' &&
        request.method === 'GET'
      )
        return await confirmEmailChange(request)
      throw new HttpError(405, '不支持此请求方法')
    }
    if (path[0] === 'dashboard' && request.method === 'GET')
      return json(await dashboard(request))
    if (path[0] === 'auth-config' && request.method === 'GET')
      return json({
        github: !!(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ),
        google: !!(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ),
        microsoft: !!(
          process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
        ),
        email: true,
        ...(await publicSettings()),
      })
    if (path[0] === 'sites' && !path[1] && request.method === 'GET')
      return json(await listSites(request))
    if (path[0] === 'sites' && path[1])
      return await manageSite(request, path[1], path[2])
    if (path[0] === 'sites' && request.method === 'POST') {
      const { user: actor } = await requireSession(request)
      const admin = await isAdmin(actor.id)
      const input = siteInput.parse(await body(request))
      const siteId = randomUUID()
      const existing = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.origin, input.origin))
        .limit(1)
      check(!existing.length, 409, '该站点地址已经存在')
      await db.transaction(async (tx) => {
        if (!admin) {
          const person = await tx
            .select({ siteLimit: user.siteLimit, disabled: user.disabled })
            .from(user)
            .where(eq(user.id, actor.id))
            .then((rows) => rows.at(0))
          check(person && !person.disabled, 403, '账号已停用')
          const [owned] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(members)
            .where(and(eq(members.userId, actor.id), eq(members.role, 'owner')))
          check(
            owned.count < person.siteLimit,
            403,
            `站点额度已用完（${person.siteLimit} 个），请联系管理员`,
          )
        }
        await tx.insert(sites).values({
          ...input,
          id: siteId,
          verificationToken: randomUUID(),
          createdAt: Date.now(),
        })
        await tx
          .insert(members)
          .values({ siteId, userId: actor.id, role: 'owner' })
        await tx.insert(auditLogs).values({
          id: randomUUID(),
          actorId: actor.id,
          actorName: actor.name,
          action: 'site.create',
          target: siteId,
          createdAt: Date.now(),
        })
      })
      return json({ id: siteId }, 201)
    }
    throw new HttpError(404, '接口不存在')
  } catch (error) {
    if (error instanceof HttpError)
      return json(
        { error: error.message },
        error.status,
        error.status === 429 ? { 'Retry-After': '60' } : {},
      )
    if (error instanceof z.ZodError)
      return json(
        {
          error: '输入不合法',
          issues: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
        400,
      )
    if (
      error instanceof Error &&
      /UNIQUE constraint failed/.test(error.message)
    )
      return json({ error: '记录已存在，请刷新后重试' }, 409)
    console.error(
      'ASCS request failed',
      error instanceof Error ? error.name : 'UnknownError',
    )
    return json({ error: '服务暂时不可用，请稍后重试' }, 500)
  }
}
