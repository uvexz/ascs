import { randomUUID } from 'node:crypto'
import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import {
  auditLogs,
  account,
  comments,
  bans,
  likes,
  instanceAdmins,
  mailQueue,
  members,
  session,
  sites,
  systemSettings,
  user,
} from '../db/schema'
import {
  adminListInput,
  systemSettingsInput,
  userUpdateInput,
  userCreateInput,
} from '../lib/system-settings'
import { id, PAGE_SIZE } from '../lib/validation'
import { body, json, params } from './http.server'
import { auth } from '../lib/auth'
import {
  check,
  digest,
  HttpError,
  limit,
  requireAdmin,
} from './security.server'
import { encryptSettings, readSettings, safeSettings } from './settings.server'
import { flushMail, testMail } from './mail.server'

type Actor = { id: string; name: string }
function audit(actor: Actor, action: string, target: string) {
  return {
    id: randomUUID(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    target,
    createdAt: Date.now(),
  }
}
async function overview() {
  const [people, siteCounts, commentCounts, mailCounts] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        disabled: sql<number>`sum(disabled)`,
      })
      .from(user),
    db
      .select({
        total: sql<number>`count(*)`,
        verified: sql<number>`sum(verified_at is not null)`,
        disabled: sql<number>`sum(not enabled)`,
      })
      .from(sites),
    db.all<{ status: string; count: number }>(
      sql`select status, count(*) as count from comments group by status`,
    ),
    db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(sent_at is null and attempts < 5)`,
        failed: sql<number>`sum(sent_at is null and attempts >= 5)`,
        sent: sql<number>`sum(sent_at is not null)`,
      })
      .from(mailQueue),
  ])
  return {
    users: people[0],
    sites: siteCounts[0],
    comments: commentCounts,
    mail: mailCounts[0],
  }
}
export type InstanceOverview = Awaited<ReturnType<typeof overview>>
async function usersList(request: Request) {
  const input = adminListInput.parse(params(request))
  const admin = sql<boolean>`exists(select 1 from instance_admins where instance_admins.user_id = ${user.id})`
  const where = and(
    input.q
      ? or(like(user.name, `%${input.q}%`), like(user.email, `%${input.q}%`))
      : undefined,
    input.status === 'disabled'
      ? eq(user.disabled, true)
      : input.status === 'active'
        ? eq(user.disabled, false)
        : input.status === 'admin'
          ? admin
          : undefined,
  )
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(where)
  const totalPages = Math.max(1, Math.ceil(total.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const items = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      siteLimit: user.siteLimit,
      createdAt: user.createdAt,
      admin,
      ownedSites: sql<number>`(select count(*) from members where members.user_id = ${user.id} and role = 'owner')`,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt), asc(user.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  return {
    items: items.map((person) => ({ ...person, admin: !!person.admin })),
    total: total.count,
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}
export type InstanceUsers = Awaited<ReturnType<typeof usersList>>
async function sitesList(request: Request) {
  const input = adminListInput.parse(params(request))
  const where = and(
    input.q
      ? or(like(sites.name, `%${input.q}%`), like(sites.origin, `%${input.q}%`))
      : undefined,
    input.status === 'disabled'
      ? eq(sites.enabled, false)
      : input.status === 'active'
        ? eq(sites.enabled, true)
        : input.status === 'pending'
          ? isNull(sites.verifiedAt)
          : undefined,
  )
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sites)
    .where(where)
  const totalPages = Math.max(1, Math.ceil(total.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const items = await db
    .select({
      id: sites.id,
      name: sites.name,
      origin: sites.origin,
      enabled: sites.enabled,
      verifiedAt: sites.verifiedAt,
      createdAt: sites.createdAt,
      comments: sql<number>`(select count(*) from comments where comments.site_id = ${sites.id} and status != 'deleted')`,
    })
    .from(sites)
    .where(where)
    .orderBy(desc(sites.createdAt), asc(sites.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  const owners = items.length
    ? await db
        .select({ siteId: members.siteId, name: user.name, email: user.email })
        .from(members)
        .innerJoin(user, eq(user.id, members.userId))
        .where(
          sql`${members.siteId} in (${sql.join(
            items.map((site) => sql`${site.id}`),
            sql`, `,
          )}) and ${members.role} = 'owner'`,
        )
    : []
  return {
    items: items.map((site) => ({
      ...site,
      owners: owners.filter((owner) => owner.siteId === site.id),
    })),
    total: total.count,
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}
export type InstanceSites = Awaited<ReturnType<typeof sitesList>>
async function mailList(request: Request) {
  const input = adminListInput.parse(params(request))
  const where =
    input.status === 'sent'
      ? isNotNull(mailQueue.sentAt)
      : input.status === 'failed'
        ? and(isNull(mailQueue.sentAt), sql`${mailQueue.attempts} >= 5`)
        : input.status === 'pending'
          ? and(isNull(mailQueue.sentAt), sql`${mailQueue.attempts} < 5`)
          : undefined
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mailQueue)
    .where(where)
  const totalPages = Math.max(1, Math.ceil(total.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const items = await db
    .select({
      id: mailQueue.id,
      to: mailQueue.to,
      subject: mailQueue.subject,
      attempts: mailQueue.attempts,
      availableAt: mailQueue.availableAt,
      sentAt: mailQueue.sentAt,
      lastError: mailQueue.lastError,
      leaseUntil: mailQueue.leaseUntil,
    })
    .from(mailQueue)
    .where(where)
    .orderBy(desc(mailQueue.availableAt), asc(mailQueue.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  return {
    items,
    total: total.count,
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}
export type InstanceMail = Awaited<ReturnType<typeof mailList>>
async function auditList(request: Request) {
  const input = adminListInput.parse(params(request))
  const [total] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
  const totalPages = Math.max(1, Math.ceil(total.count / PAGE_SIZE))
  const page = Math.min(input.page, totalPages)
  const items = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt), asc(auditLogs.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
  return {
    items,
    total: total.count,
    page,
    totalPages,
    hasMore: page < totalPages,
  }
}
export type InstanceAudit = Awaited<ReturnType<typeof auditList>>

export async function handleAdmin(request: Request, path: string[]) {
  const actor = await requireAdmin(request)
  const [resource, target, action] = path
  if (request.method === 'GET' && !target) {
    if (resource === 'overview') return json(await overview())
    if (resource === 'settings') return json(await safeSettings())
    if (resource === 'users') return json(await usersList(request))
    if (resource === 'sites') return json(await sitesList(request))
    if (resource === 'mail') return json(await mailList(request))
    if (resource === 'audit') return json(await auditList(request))
  }
  if (resource === 'settings' && request.method === 'PATCH' && !target) {
    const input = systemSettingsInput
      .and(z.object({ revision: z.number().int().min(0) }))
      .parse(await body(request))
    await db.transaction(async (tx) => {
      const current = await readSettings(tx)
      check(
        current.revision === input.revision,
        409,
        '配置已被其他管理员更新，请刷新后重试',
      )
      const settings = systemSettingsInput.parse(input)
      settings.smtp.password = settings.smtp.clearPassword
        ? ''
        : settings.smtp.password || current.settings.smtp.password
      delete settings.smtp.clearPassword
      check(
        !settings.smtp.enabled ||
          !settings.smtp.username ||
          settings.smtp.password,
        400,
        'SMTP 认证需要密码',
      )
      const value = {
        id: 1,
        value: encryptSettings(settings),
        revision: input.revision + 1,
        updatedAt: Date.now(),
      }
      if (current.saved) {
        const changed = await tx
          .update(systemSettings)
          .set(value)
          .where(
            and(
              eq(systemSettings.id, 1),
              eq(systemSettings.revision, input.revision),
            ),
          )
          .returning()
        check(changed.length, 409, '配置已更新，请刷新后重试')
      } else await tx.insert(systemSettings).values(value)
      await tx
        .insert(auditLogs)
        .values(audit(actor, 'settings.update', 'system'))
    })
    return json(await safeSettings())
  }
  if (
    resource === 'settings' &&
    request.method === 'POST' &&
    target === 'smtp-test'
  ) {
    await limit(`admin-test:${actor.id}`, 5)
    const input = z
      .object({ to: z.email().max(254) })
      .parse(await body(request))
    try {
      check(await testMail(input.to), 400, 'SMTP 未启用')
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(400, 'SMTP 连接或发送失败，请检查地址、TLS 和凭据')
    }
    await db
      .insert(auditLogs)
      .values(audit(actor, `settings.${target}`, 'system'))
    return json({ ok: true })
  }
  if (resource === 'users' && request.method === 'POST' && !target) {
    const input = userCreateInput.parse(await body(request))
    const context = await auth.$context
    const password = await context.password.hash(input.password)
    const personId = randomUUID()
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: personId,
        name: input.name,
        email: input.email,
        siteLimit: input.siteLimit,
        disabled: input.disabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await tx.insert(account).values({
        id: randomUUID(),
        userId: personId,
        accountId: personId,
        providerId: 'credential',
        password,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      if (input.admin)
        await tx.insert(instanceAdmins).values({ userId: personId })
      await tx.insert(auditLogs).values(audit(actor, 'user.create', personId))
    })
    return json({ id: personId }, 201)
  }
  if (resource === 'users' && target) {
    id.parse(target)
    if (request.method === 'DELETE' && !action) {
      check(target !== actor.id, 400, '不能删除自己的账号')
      await db.transaction(async (tx) => {
        const [person] = await tx.select().from(user).where(eq(user.id, target))
        check(person, 404, '用户不存在')
        const owned = await tx
          .select()
          .from(members)
          .where(and(eq(members.userId, target), eq(members.role, 'owner')))
          .limit(1)
        check(!owned.length, 409, '请先在全部站点中转移该用户拥有的站点')
        const [remaining] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(instanceAdmins)
          .innerJoin(user, eq(user.id, instanceAdmins.userId))
          .where(and(eq(user.disabled, false), sql`${user.id} != ${target}`))
        check(remaining.count > 0, 400, '必须保留至少一个有效管理员')
        await tx
          .update(comments)
          .set({
            author: '已注销用户',
            userId: null,
            emailHash: null,
            ipHash: '',
          })
          .where(eq(comments.userId, target))
        await tx.delete(likes).where(eq(likes.voter, digest(`user:${target}`)))
        await tx
          .delete(bans)
          .where(and(eq(bans.kind, 'user'), eq(bans.value, target)))
        await tx.delete(mailQueue).where(eq(mailQueue.to, person.email))
        await tx.delete(user).where(eq(user.id, target))
        await tx.insert(auditLogs).values(audit(actor, 'user.delete', target))
      })
      return json({ ok: true })
    }
    if (request.method === 'PATCH' && !action) {
      const input = userUpdateInput.parse(await body(request))
      check(
        target !== actor.id || (input.admin && !input.disabled),
        400,
        '不能停用自己或移除自己的管理员权限',
      )
      await db.transaction(async (tx) => {
        const [person] = await tx.select().from(user).where(eq(user.id, target))
        check(person, 404, '用户不存在')
        const existingAdmin = await tx
          .select()
          .from(instanceAdmins)
          .where(eq(instanceAdmins.userId, target))
          .then((rows) => rows.at(0))
        if (existingAdmin && (!input.admin || input.disabled)) {
          const [remaining] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(instanceAdmins)
            .innerJoin(user, eq(user.id, instanceAdmins.userId))
            .where(and(eq(user.disabled, false), sql`${user.id} != ${target}`))
          check(remaining.count > 0, 400, '必须保留至少一个有效管理员')
        }
        await tx
          .update(user)
          .set({
            name: input.name,
            siteLimit: input.siteLimit,
            disabled: input.disabled,
            updatedAt: new Date(),
          })
          .where(eq(user.id, target))
        if (input.admin)
          await tx
            .insert(instanceAdmins)
            .values({ userId: target })
            .onConflictDoNothing()
        else
          await tx
            .delete(instanceAdmins)
            .where(eq(instanceAdmins.userId, target))
        if (input.disabled || !!existingAdmin !== input.admin)
          await tx.delete(session).where(eq(session.userId, target))
        await tx
          .insert(auditLogs)
          .values(
            audit(
              actor,
              `user.update:${input.admin ? 'admin' : 'member'}:${input.disabled ? 'disabled' : 'active'}:limit=${input.siteLimit}`,
              target,
            ),
          )
      })
      return json({ ok: true })
    }
    if (request.method === 'POST' && action === 'revoke-sessions') {
      await db.transaction(async (tx) => {
        const [person] = await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, target))
        check(person, 404, '用户不存在')
        await tx.delete(session).where(eq(session.userId, target))
        await tx
          .insert(auditLogs)
          .values(audit(actor, 'user.revoke-sessions', target))
      })
      return json({ ok: true })
    }
  }
  if (
    resource === 'sites' &&
    target &&
    request.method === 'POST' &&
    action === 'transfer'
  ) {
    id.parse(target)
    const input = z
      .object({ email: z.email().max(254) })
      .parse(await body(request))
    await db.transaction(async (tx) => {
      const [site] = await tx.select().from(sites).where(eq(sites.id, target))
      check(site, 404, '站点不存在')
      const person = await tx
        .select()
        .from(user)
        .where(eq(user.email, input.email.toLowerCase()))
        .then((rows) => rows.at(0))
      check(person && !person.disabled, 400, '新所有者不存在或已停用')
      const admin = await tx
        .select()
        .from(instanceAdmins)
        .where(eq(instanceAdmins.userId, person.id))
        .then((rows) => rows.at(0))
      const [owned] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(members)
        .where(
          and(
            eq(members.userId, person.id),
            eq(members.role, 'owner'),
            sql`${members.siteId} != ${target}`,
          ),
        )
      check(
        admin || owned.count < person.siteLimit,
        400,
        '新所有者站点额度不足，请先调整额度',
      )
      await tx
        .delete(members)
        .where(and(eq(members.siteId, target), eq(members.role, 'owner')))
      await tx
        .insert(members)
        .values({ siteId: target, userId: person.id, role: 'owner' })
        .onConflictDoUpdate({
          target: [members.siteId, members.userId],
          set: { role: 'owner' },
        })
      await tx
        .insert(auditLogs)
        .values(audit(actor, 'site.transfer', `${target}:${person.id}`))
    })
    return json({ ok: true })
  }
  if (resource === 'sites' && target && request.method === 'PATCH' && !action) {
    id.parse(target)
    const input = z.object({ enabled: z.boolean() }).parse(await body(request))
    await db.transaction(async (tx) => {
      const changed = await tx
        .update(sites)
        .set(input)
        .where(eq(sites.id, target))
        .returning()
      check(changed.length, 404, '站点不存在')
      await tx
        .insert(auditLogs)
        .values(
          audit(actor, input.enabled ? 'site.enable' : 'site.disable', target),
        )
    })
    return json({ ok: true })
  }
  if (resource === 'mail' && request.method === 'POST') {
    if (target === 'flush') {
      await limit(`admin-mail:${actor.id}`, 3)
      const result = await flushMail()
      await db.insert(auditLogs).values(audit(actor, 'mail.flush', 'queue'))
      return json(result)
    }
    if (target && action === 'retry') {
      id.parse(target)
      await db.transaction(async (tx) => {
        const changed = await tx
          .update(mailQueue)
          .set({ attempts: 0, availableAt: Date.now(), lastError: null })
          .where(
            and(
              eq(mailQueue.id, target),
              isNull(mailQueue.sentAt),
              lte(mailQueue.leaseUntil, Date.now()),
            ),
          )
          .returning()
        check(changed.length, 409, '邮件已发送、正在处理或不存在')
        await tx.insert(auditLogs).values(audit(actor, 'mail.retry', target))
      })
      return json({ ok: true })
    }
  }
  throw new HttpError(404, '管理接口不存在')
}
