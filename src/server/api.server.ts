import { randomUUID } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import {
  bans,
  comments,
  invitations,
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
  allow,
  authorize,
  baseOrigin,
  bearerToken,
  challenge,
  check,
  digest,
  getSession,
  HttpError,
  ipHash,
  isAdmin,
  limit,
  lockWrite,
  mintWidgetSession,
  requireOrigin,
  requireSession,
  revokeWidgetSession,
  secureEqual,
  verifyChallenge,
  voterIdentity,
} from './security.server'
import { captchaEndpoint, captchaFailure, captchaWasm } from './captcha.server'
import { moderateComment } from './moderation.server'
import { extractLinks } from '../lib/moderation'
import { enqueueMail, flushMail } from './mail.server'
import { invalidateSite, siteById } from './site-cache.server'
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
  const site = await siteById(input.siteId)
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
  // Tracking parameters create duplicate threads for the same article. Strip
  // the common ones; meaningful query parameters (for example `?p=123`) stay
  // part of the URL, and sites that need a stable id should pass `data-page`.
  for (const key of [...url.searchParams.keys()])
    if (
      /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_cid$|mc_eid$|_ga$|ref$)/i.test(
        key,
      )
    )
      url.searchParams.delete(key)
  return { site, pageUrl: url.href, pageKey: input.pageKey || url.href }
}
// A deleted comment exists only to anchor the replies below it, so it stays on
// the board while at least one descendant is visible; a leaf deletion is gone
// entirely. Approval is terminal and depth is capped at 4, so a finite nesting
// of EXISTS covers every possible chain without a recursive CTE.
const MAX_COMMENT_DEPTH = 4
function visibleComment(alias: string, level = 0): string {
  const approved = `${alias}.status = 'approved'`
  if (level >= MAX_COMMENT_DEPTH) return approved
  const child = `vc${level + 1}`
  return `(${approved} or (${alias}.status = 'deleted' and exists (select 1 from comments ${child} where ${child}.parent_id = ${alias}.id and ${child}.site_id = ${alias}.site_id and ${child}.page_key = ${alias}.page_key and ${visibleComment(child, level + 1)})))`
}
const visibleComments = sql.raw(visibleComment('comments'))

// A thread page lists every visible descendant of one root comment. The widget
// renders the discussion as a single flat conversation column, so replies below
// the first level arrive in the same page instead of one request per parent.
// Only visible nodes are walked: a deleted comment that still anchors a visible
// reply is itself visible (see visibleComment), while a comment hidden by
// moderation stays hidden together with its subtree, as in the previous list.
function threadScope(rootId: string, siteId: string, pageKey: string) {
  return sql`${comments.id} in (
    with recursive thread(id, depth) as (
      select id, depth from comments
      where parent_id = ${rootId} and site_id = ${siteId} and page_key = ${pageKey}
        and ${sql.raw(visibleComment('comments'))}
      union all
      select c.id, c.depth from comments c
      join thread t on c.parent_id = t.id
      where c.site_id = ${siteId} and c.page_key = ${pageKey}
        and c.depth = t.depth + 1 and c.depth <= ${MAX_COMMENT_DEPTH}
        and ${sql.raw(visibleComment('c'))}
    )
    select id from thread
  )`
}

const counts = (siteId: string) =>
  db
    .select({ status: comments.status, count: sql<number>`count(*)` })
    .from(comments)
    .where(eq(comments.siteId, siteId))
    .groupBy(comments.status)

// Bounded author history for AI moderation (one aggregate query, no PII): how
// many comments this identity has left on the site and how many in the last
// week. Deleted comments are excluded so cleaned-up history is not counted.
async function commentHistory(
  siteId: string,
  userId: string | null,
  emailHash: string,
) {
  const recentSince = Date.now() - 7 * 24 * 60 * 60 * 1000
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      recent: sql<
        number | null
      >`sum(case when ${comments.createdAt} > ${recentSince} then 1 else 0 end)`,
    })
    .from(comments)
    .where(
      and(
        eq(comments.siteId, siteId),
        userId
          ? eq(comments.userId, userId)
          : eq(comments.emailHash, emailHash),
        ne(comments.status, 'deleted'),
      ),
    )
  return { total: row.total, recent: row.recent ?? 0 }
}

async function listComments(request: Request) {
  const input = listInput.parse(params(request))
  const { site, pageKey } = await publicContext(input)
  // Three list scopes share one response shape: roots (default), one comment's
  // direct replies (`parentId`, kept for API compatibility), or one root's whole
  // flattened discussion (`rootId`).
  let scope: SQL<unknown>
  if (input.rootId) {
    const [root] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(
        and(
          eq(comments.id, input.rootId),
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          isNull(comments.parentId),
          visibleComments,
        ),
      )
      .limit(1)
    check(root, 404, '讨论不存在')
    scope = threadScope(input.rootId, site.id, pageKey)
  } else if (input.parentId) {
    const [parent] = await db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.id, input.parentId),
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          visibleComments,
        ),
      )
      .limit(1)
    check(parent, 404, '回复不存在')
    scope = eq(comments.parentId, input.parentId)
  } else {
    scope = isNull(comments.parentId)
  }
  const where = and(
    eq(comments.siteId, site.id),
    eq(comments.pageKey, pageKey),
    scope,
    visibleComments,
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
  const replyCount = sql<number>`(select count(*) from comments as replies where replies.parent_id = "comments"."id" and replies.site_id = "comments"."site_id" and replies.page_key = "comments"."page_key" and ${sql.raw(visibleComment('replies'))})`
  // Context for flattened deep replies: whose comment the author answered. Only
  // an approved parent can expose a name; a deleted or hidden parent resolves to
  // null and the widget shows a generic note instead.
  const parentAuthor = sql<
    string | null
  >`(select coalesce(pu.name, p.author) from comments p left join "user" pu on pu.id = p.user_id where p.id = "comments"."parent_id" and p.site_id = "comments"."site_id" and p.page_key = "comments"."page_key" and p.status = 'approved')`
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      parentAuthor,
      author: sql<string>`case when ${comments.status} = 'deleted' then '已删除' else coalesce(${user.name}, ${comments.author}) end`,
      image: sql<
        string | null
      >`case when ${comments.status} = 'deleted' then null else ${user.image} end`,
      website: sql<
        string | null
      >`case when ${comments.status} = 'deleted' then null else ${user.website} end`,
      body: sql<string>`case when ${comments.status} = 'deleted' then '' else ${comments.body} end`,
      registered: sql<number>`${comments.userId} is not null`,
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
    items: rows.map((row) => ({
      ...row,
      liked: !!row.liked,
      registered: !!row.registered,
    })),
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
  const visibleNode = (commentId: string) =>
    db
      .select({ id: comments.id, parentId: comments.parentId })
      .from(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.siteId, site.id),
          eq(comments.pageKey, pageKey),
          visibleComments,
        ),
      )
      .limit(1)
  let [node] = await visibleNode(input.commentId)
  check(node, 404, '评论或其所属讨论暂不可见，请稍后重试')
  // Replies always render with their discussion, so only the page holding the
  // root comment matters when the widget reveals a newly posted comment. The
  // bound also stops a corrupted parent chain from looping forever.
  for (let level = 0; node.parentId; level++) {
    check(level < MAX_COMMENT_DEPTH, 400, '讨论层级超出范围')
    const parentId = node.parentId
    const [parent] = await visibleNode(parentId)
    check(parent, 404, '评论或其所属讨论暂不可见，请稍后重试')
    node = parent
  }
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
        isNull(comments.parentId),
        visibleComments,
      ),
    )
    .as('ranked')
  const [rank] = await db
    .select({ position: ranked.position })
    .from(ranked)
    .where(eq(ranked.id, node.id))
  check(rank, 404, '评论暂不可见，请稍后重试')
  // `rootId` lets the widget open and extend the discussion that now holds the
  // comment; `page` is the root-list page it has to be on.
  return {
    id: input.commentId,
    rootId: node.id,
    page: Math.ceil(rank.position / PAGE_SIZE),
  }
}
export type CommentLocation = Awaited<ReturnType<typeof locateComment>>

async function createComment(request: Request) {
  const input = commentInput.parse(await body(request))
  const { site, pageKey, pageUrl } = await publicContext(input)
  const ip = ipHash(request)
  await limit(`comment:${site.id}:${ip}`, 5, 60_000)
  await limit(`comment-global:${ip}`, 40, 3_600_000)
  verifyChallenge(input.challenge, site.id, pageKey)
  check(!input.honeypot, 400, '评论未通过垃圾检测')
  const failure = await captchaFailure(input.captchaToken)
  if (failure) throw new HttpError(failure.status, failure.message)
  const session = await getSession(request)
  check(
    !session?.widget || session.widgetSiteId === site.id,
    403,
    '登录状态不适用于此站点，请重新登录',
  )
  check(site.allowAnonymous || session, 401, '此站点需要登录后评论')
  check(session || (input.author && input.email), 400, '匿名评论需要昵称和邮箱')
  const emailHash = digest(
    `email:${(session?.user.email || input.email!).toLowerCase()}`,
  )
  const author = session?.user.name || input.author!
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
  let parentContext: { author: string; body: string } | null = null
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
    parentContext = { author: parent.author, body: parent.body }
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
  // Blocked words apply to every user-controlled surface, not just the body;
  // otherwise a nickname or profile website can carry the blocked term.
  const localText = [input.body, author, session?.user.website ?? '']
    .join('\n')
    .toLowerCase()
  const localSpamReason = words.some((word) => localText.includes(word))
    ? 'blocked-word'
    : extractLinks(input.body).length > 3
      ? 'too-many-links'
      : null
  const baselineStatus: 'pending' | 'approved' =
    site.moderation === 'all' || (site.moderation === 'anonymous' && !session)
      ? 'pending'
      : 'approved'
  let spamReason = localSpamReason
  let status: 'pending' | 'approved' | 'spam' = localSpamReason
    ? 'spam'
    : baselineStatus
  // Local rules win and are never softened. While AI detection is enabled its
  // decision is authoritative: an approval publishes the comment directly (it is
  // not downgraded to the site's baseline review policy), a review/unavailable
  // result holds it, and only a quarantine marks it spam. `unavailable` is mapped
  // by SPAM_FAIL_MODE; the site's `moderation` policy only applies when detection
  // is disabled.
  if (!localSpamReason) {
    const history = await commentHistory(
      site.id,
      session?.user.id ?? null,
      emailHash,
    )
    const moderation = await moderateComment({
      pageUrl,
      pageKey,
      pageTitle: input.pageTitle ?? null,
      pageDescription: input.pageDescription ?? null,
      body: input.body,
      authorName: author,
      registered: !!session,
      authorWebsite: session?.user.website ?? null,
      authorComments: history.total,
      authorRecentComments: history.recent,
      parentAuthor: parentContext?.author ?? null,
      parentBody: parentContext?.body ?? null,
      links: extractLinks(input.body),
    })
    if (moderation.enabled) {
      spamReason = moderation.mapped.reason
      status = moderation.mapped.status
    }
  }
  // Only a verified member address may receive notifications, and the site
  // gets a bounded number per hour. Re-checking at send time also protects
  // deployments whose stored settings predate the settings-endpoint validation.
  let notify = false
  if (site.notificationEmail && status !== 'spam') {
    const recipient = site.notificationEmail.toLowerCase()
    const member = await db
      .select({ id: members.userId })
      .from(members)
      .innerJoin(user, eq(user.id, members.userId))
      .where(
        and(
          eq(members.siteId, site.id),
          eq(user.email, recipient),
          eq(user.emailVerified, true),
        ),
      )
      .limit(1)
      .then((rows) => rows.at(0))
    notify = !!member && (await allow(`notify:${site.id}`, 20, 3_600_000))
  }
  const commentId = randomUUID()
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
    if (notify && site.notificationEmail)
      await tx.insert(mailQueue).values({
        id: randomUUID(),
        to: site.notificationEmail,
        subject: `[ASCS] ${site.name} 有新评论`,
        body: `${author}：\n${input.body}\n\n文章：${pageUrl}\n状态：${status}\n管理：${baseOrigin()}/`,
        availableAt: Date.now(),
      })
  })
  if (notify) setTimeout(() => void flushMail().catch(() => {}), 0)
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
  check(
    !session?.widget || session.widgetSiteId === site.id,
    403,
    '登录状态不适用于此站点，请重新登录',
  )
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
  // Report the stored state, not the branch taken, so concurrent clicks cannot
  // leave the client showing a like that no longer exists (or the reverse).
  const [current] = await db
    .select({ voter: likes.voter })
    .from(likes)
    .where(
      and(eq(likes.commentId, comment.id), eq(likes.voter, identity.voter)),
    )
    .limit(1)
  return json(
    { liked: !!current },
    200,
    identity.cookie ? { 'Set-Cookie': identity.cookie } : {},
  )
}

export async function dashboard(request: Request) {
  const session = await requireSession(request)
  const admin = await isAdmin(session.user.id)
  // Only expose the fields the shell needs; verification tokens, blocked words
  // and notification addresses stay behind the site-detail endpoint.
  const siteFields = {
    id: sites.id,
    name: sites.name,
    origin: sites.origin,
    verifiedAt: sites.verifiedAt,
    enabled: sites.enabled,
  }
  let accessible: Array<
    Pick<typeof sites.$inferSelect, keyof typeof siteFields> & {
      role?: 'owner' | 'moderator'
    }
  >
  if (admin) {
    accessible = await db
      .select(siteFields)
      .from(sites)
      .orderBy(desc(sites.createdAt))
      .limit(PAGE_SIZE)
  } else {
    accessible = await db
      .select({ ...siteFields, role: members.role })
      .from(members)
      .innerJoin(sites, eq(sites.id, members.siteId))
      .where(eq(members.userId, session.user.id))
  }
  const ownedSites = accessible.filter((site) => site.role === 'owner').length
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    admin,
    siteLimit: session.user.siteLimit,
    ownedSites,
    canCreateSite: admin || ownedSites < session.user.siteLimit,
    instance: await publicSettings(),
    sites: accessible.map((site) => ({
      ...site,
      role: site.role ?? ('owner' as const),
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

export async function siteDetail(
  request: Request,
  siteId: string,
): Promise<SiteDetail> {
  id.parse(siteId)
  const { site, user: actor, role } = await authorize(request, siteId)
  const [stats, banned, team, pending, daily] = await Promise.all([
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
    role === 'owner'
      ? db
          .select({
            id: invitations.id,
            email: invitations.email,
            role: invitations.role,
            createdAt: invitations.createdAt,
            expiresAt: invitations.expiresAt,
          })
          .from(invitations)
          .where(
            and(
              eq(invitations.siteId, siteId),
              isNull(invitations.acceptedAt),
              gt(invitations.expiresAt, Date.now()),
            ),
          )
          .orderBy(desc(invitations.createdAt))
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
  return {
    // Verification token, blocked words and the notification address are
    // owner-only; moderators get the rest of the site record.
    site:
      role === 'owner'
        ? site
        : {
            ...site,
            verificationToken: '',
            blockedWords: '',
            notificationEmail: null,
          },
    role,
    selfId: actor.id,
    stats,
    bans: banned,
    members: team,
    invitations: pending,
    daily,
    canBanIp: !!process.env.TRUSTED_IP_HEADER,
  }
}

async function manageSite(request: Request, siteId: string, action?: string) {
  if (!action && request.method === 'GET')
    return json(await siteDetail(request, siteId))
  id.parse(siteId)
  const {
    site,
    user: actor,
    role,
  } = await authorize(
    request,
    siteId,
    ['verify', 'settings', 'invitations'].includes(action || '') ||
      request.method === 'PATCH',
  )
  if (!action && request.method === 'PATCH') {
    const settings = siteSettings.parse(await body(request))
    if (settings.notificationEmail) {
      const [member] = await db
        .select({ id: user.id })
        .from(members)
        .innerJoin(user, eq(user.id, members.userId))
        .where(
          and(
            eq(members.siteId, siteId),
            eq(user.email, settings.notificationEmail.toLowerCase()),
            eq(user.emailVerified, true),
          ),
        )
        .limit(1)
      check(member, 400, '通知邮箱必须是站点成员的已验证邮箱')
    }
    await db.update(sites).set(settings).where(eq(sites.id, siteId))
    invalidateSite(siteId)
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
    await db.transaction(async (tx) => {
      await lockWrite(tx)
      const [conflict] = await tx
        .select({ id: sites.id })
        .from(sites)
        .where(
          and(
            eq(sites.origin, site.origin),
            isNotNull(sites.verifiedAt),
            ne(sites.id, siteId),
          ),
        )
        .limit(1)
      check(!conflict, 409, '该站点地址已被其他已验证站点占用')
      await tx
        .update(sites)
        .set({ verifiedAt: Date.now() })
        .where(eq(sites.id, siteId))
      // Whoever proved DNS ownership wins; other pending claims for the same
      // origin are removed so they cannot linger as a takeover attempt.
      await tx
        .delete(sites)
        .where(
          and(
            eq(sites.origin, site.origin),
            isNull(sites.verifiedAt),
            ne(sites.id, siteId),
          ),
        )
      await tx.insert(auditLogs).values({
        id: randomUUID(),
        actorId: actor.id,
        actorName: actor.name,
        action: 'site.verify',
        target: siteId,
        createdAt: Date.now(),
      })
    })
    invalidateSite(siteId)
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
    check(role === 'owner', 403, '只有站点所有者可以邀请成员')
    // DNS ownership must be proven first: an unverified site would otherwise
    // let any account use the instance SMTP to mail arbitrary addresses.
    check(site.verifiedAt, 400, '请先完成站点 DNS 验证，再邀请成员')
    const input = memberInput.parse(await body(request))
    check(
      input.role !== 'owner' || input.confirmOwner,
      400,
      '请确认授予所有者权限',
    )
    await limit(`invite:${siteId}`, 20, 3_600_000)
    const email = input.email.toLowerCase()
    const now = Date.now()
    const token = randomUUID()
    const alreadyMember = await db.transaction(async (tx) => {
      await lockWrite(tx)
      // Do not reveal whether the address is registered: an address that is not
      // already a member of this site gets the same 202 response either way.
      // Only an existing member is reported back, with a 409 and a clear hint.
      const person = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)
        .then((rows) => rows.at(0))
      if (person) {
        const existing = await tx
          .select({ role: members.role })
          .from(members)
          .where(and(eq(members.siteId, siteId), eq(members.userId, person.id)))
          .limit(1)
          .then((rows) => rows.at(0))
        if (existing) return true
      }
      await tx
        .insert(invitations)
        .values({
          id: randomUUID(),
          siteId,
          email,
          role: input.role,
          token,
          invitedBy: actor.id,
          createdAt: now,
          expiresAt: now + 7 * 86_400_000,
        })
        .onConflictDoUpdate({
          target: [invitations.siteId, invitations.email],
          set: {
            role: input.role,
            token,
            invitedBy: actor.id,
            createdAt: now,
            expiresAt: now + 7 * 86_400_000,
            acceptedAt: null,
          },
        })
      return false
    })
    if (alreadyMember)
      throw new HttpError(
        409,
        '该用户已是站点成员；如需修改角色，请先移除后重新邀请',
      )
    await enqueueMail(
      email,
      `邀请你加入 ${site.name}`,
      `${actor.name} 邀请你以${input.role === 'owner' ? '所有者' : '审核员'}身份加入站点「${site.name}」。\n\n请打开以下链接接受邀请：\n${baseOrigin()}/accept-invitation?token=${encodeURIComponent(token)}\n\n链接 7 天内有效。如果这不是你的操作，请忽略此邮件。`,
    )
    await flushMail().catch(() => {})
    return json({ ok: true, invited: true }, 202)
  }
  if (action === 'members' && request.method === 'DELETE') {
    const input = z.object({ userId: id }).parse(await body(request))
    const leaving = input.userId === actor.id
    if (!leaving) check(role === 'owner', 403, '只有站点所有者可以移除成员')
    await db.transaction(async (tx) => {
      await lockWrite(tx)
      const [targetMember] = await tx
        .select()
        .from(members)
        .where(
          and(eq(members.siteId, siteId), eq(members.userId, input.userId)),
        )
        .limit(1)
      check(targetMember, 400, '该用户不是站点成员')
      if (targetMember.role === 'owner') {
        check(leaving, 400, '不能移除站点所有者，请先转移所有权')
        const [owners] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(members)
          .where(and(eq(members.siteId, siteId), eq(members.role, 'owner')))
        check(owners.count > 1, 400, '你是唯一所有者，请先转移所有权')
      }
      await tx
        .delete(members)
        .where(
          and(eq(members.siteId, siteId), eq(members.userId, input.userId)),
        )
    })
    return json({ ok: true })
  }
  if (action === 'invitations' && request.method === 'DELETE') {
    const input = z.object({ invitationId: id }).parse(await body(request))
    const removed = await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.id, input.invitationId),
          eq(invitations.siteId, siteId),
        ),
      )
      .returning({ id: invitations.id })
    check(removed.length, 404, '邀请不存在或已被使用')
    return json({ ok: true })
  }
  throw new HttpError(404, '接口不存在')
}
export type SiteDetail = {
  site: typeof sites.$inferSelect
  role: 'owner' | 'moderator'
  selfId: string
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
  invitations: {
    id: string
    email: string
    role: 'owner' | 'moderator'
    createdAt: number
    expiresAt: number
  }[]
  daily: { day: string; count: number }[]
}

async function acceptInvitation(request: Request) {
  const session = await requireSession(request)
  const input = z
    .object({ token: z.string().min(1).max(200) })
    .parse(await body(request))
  await limit(`invite-accept:${session.user.id}`, 10)
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, input.token))
    .limit(1)
  check(invitation, 404, '邀请不存在或已失效')
  check(!invitation.acceptedAt, 409, '邀请已被使用')
  check(invitation.expiresAt > Date.now(), 410, '邀请已过期')
  check(
    invitation.email === session.user.email.toLowerCase(),
    403,
    '请使用被邀请的邮箱登录后再接受邀请',
  )
  check(!session.user.disabled, 403, '账号已停用')
  const admin = await isAdmin(session.user.id)
  await db.transaction(async (tx) => {
    await lockWrite(tx)
    const [site] = await tx
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.id, invitation.siteId))
      .limit(1)
    check(site, 404, '站点不存在')
    const existing = await tx
      .select({ role: members.role })
      .from(members)
      .where(
        and(
          eq(members.siteId, invitation.siteId),
          eq(members.userId, session.user.id),
        ),
      )
      .limit(1)
      .then((rows) => rows.at(0))
    if (!existing) {
      if (invitation.role === 'owner' && !admin) {
        const [owned] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(members)
          .where(
            and(eq(members.userId, session.user.id), eq(members.role, 'owner')),
          )
        check(
          owned.count < session.user.siteLimit,
          400,
          '你的站点额度不足，无法接受所有者邀请',
        )
      }
      await tx
        .insert(members)
        .values({
          siteId: invitation.siteId,
          userId: session.user.id,
          role: invitation.role,
        })
        .onConflictDoNothing()
    }
    await tx
      .update(invitations)
      .set({ acceptedAt: Date.now() })
      .where(
        and(eq(invitations.id, invitation.id), isNull(invitations.acceptedAt)),
      )
  })
  return json({ ok: true, siteId: invitation.siteId })
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
          captcha: captchaEndpoint(),
          captchaWasm: captchaWasm(),
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
        request.method === 'POST'
      )
        return json(await confirmEmailChange(request))
      throw new HttpError(405, '不支持此请求方法')
    }
    if (
      path[0] === 'invitations' &&
      path[1] === 'accept' &&
      request.method === 'POST'
    )
      return await acceptInvitation(request)
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
        captcha: captchaEndpoint(),
        captchaWasm: captchaWasm(),
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
      await db.transaction(async (tx) => {
        await lockWrite(tx)
        const [verified] = await tx
          .select({ id: sites.id })
          .from(sites)
          .where(
            and(eq(sites.origin, input.origin), isNotNull(sites.verifiedAt)),
          )
          .limit(1)
        check(!verified, 409, '该站点地址已经被已验证站点占用')
        // An unverified claim never reserves an origin. Multiple users may
        // register the same origin; the first one to prove DNS ownership wins
        // and the verification path removes the rest.
        const [ownPending] = await tx
          .select({ id: sites.id })
          .from(sites)
          .innerJoin(members, eq(members.siteId, sites.id))
          .where(
            and(
              eq(sites.origin, input.origin),
              eq(members.userId, actor.id),
              isNull(sites.verifiedAt),
            ),
          )
          .limit(1)
        check(!ownPending, 409, '你已创建过该站点，请继续完成验证')
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
    if (path[0] === 'widget' && path[1] === 'session') {
      if (request.method === 'GET') {
        const session = await getSession(request)
        check(session, 401, '请先登录')
        return json({
          user: {
            id: session.user.id,
            name: session.user.name,
            image: session.user.image,
          },
        })
      }
      if (request.method === 'POST') {
        const { user: actor } = await requireSession(request)
        await limit(`widget-session:${actor.id}`, 20)
        const input = z.object({ siteId: id }).parse(await body(request))
        const site = await siteById(input.siteId)
        check(
          site?.verifiedAt && site.enabled,
          404,
          '站点未验证、已停用或不存在',
        )
        const created = await mintWidgetSession(actor.id, input.siteId)
        return json(
          {
            token: created.token,
            expiresAt: created.expiresAt,
            user: { id: actor.id, name: actor.name, image: actor.image },
          },
          201,
        )
      }
      if (request.method === 'DELETE') {
        await revokeWidgetSession(bearerToken(request))
        return json({ ok: true })
      }
      throw new HttpError(405, '不支持此请求方法')
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
