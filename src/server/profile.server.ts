import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../db'
import { account, user } from '../db/schema'
import { emailChangeInput, profileInput } from '../lib/validation'
import { body, params } from './http.server'
import { enqueueMail } from './mail.server'
import {
  baseOrigin,
  check,
  emailChangeToken,
  ipHash,
  limit,
  readEmailChangeToken,
  requireSession,
} from './security.server'

const profileFields = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  website: user.website,
  bio: user.bio,
}

export async function getProfile(request: Request) {
  const { user: person } = await requireSession(request)
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    image: person.image,
    website: person.website,
    bio: person.bio,
  }
}
export type Profile = Awaited<ReturnType<typeof getProfile>>

export async function updateProfile(request: Request) {
  const { user: person } = await requireSession(request)
  await limit(`profile:${person.id}`, 10)
  const input = profileInput.parse(await body(request))
  const updated = await db
    .update(user)
    .set({
      name: input.name,
      image: input.image || null,
      website: input.website || null,
      bio: input.bio || null,
      updatedAt: new Date(),
    })
    .where(and(eq(user.id, person.id), eq(user.disabled, false)))
    .returning(profileFields)
    .then((rows) => rows.at(0))
  check(updated, 403, '账号已停用或不存在')
  return updated
}

type ProfileAccount = { id: string; providerId: string }

async function listAccounts(userId: string): Promise<ProfileAccount[]> {
  return await db
    .select({ id: account.id, providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
}

const hasCredential = (accounts: ProfileAccount[]) =>
  accounts.some((item) => item.providerId === 'credential')

export async function getProfileAccounts(request: Request) {
  const { user: person } = await requireSession(request)
  const accounts = await listAccounts(person.id)
  const hasPassword = hasCredential(accounts)
  return {
    accounts,
    hasPassword,
    emailChangeUsedAt: person.emailChangeUsedAt?.getTime() ?? null,
    canChangeEmail: !hasPassword && !person.emailChangeUsedAt,
  }
}
export type ProfileAccounts = Awaited<ReturnType<typeof getProfileAccounts>>

export async function requestEmailChange(request: Request) {
  const { user: person } = await requireSession(request)
  await limit(`profile-email:${person.id}`, 5)
  check(
    !hasCredential(await listAccounts(person.id)),
    403,
    '仅第三方登录账号可以修改邮箱',
  )
  check(!person.emailChangeUsedAt, 409, '你已经使用过修改邮箱的机会')
  const input = emailChangeInput.parse(await body(request))
  const newEmail = input.email.toLowerCase()
  check(newEmail !== person.email.toLowerCase(), 400, '新邮箱与当前邮箱相同')
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, newEmail))
    .limit(1)
  check(!existing.length, 409, '该邮箱已被使用')
  const token = emailChangeToken(
    person.id,
    newEmail,
    person.email.toLowerCase(),
  )
  await enqueueMail(
    newEmail,
    '确认修改邮箱',
    `请打开以下链接确认将账号邮箱修改为 ${newEmail}：\n${baseOrigin()}/api/v1/profile/email/confirm?token=${encodeURIComponent(token)}\n链接 1 小时内有效。如果这不是你的操作，请忽略此邮件。`,
  )
  return { status: true }
}

export async function confirmEmailChange(request: Request) {
  const target = (reason: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${baseOrigin()}/profile?emailChange=${reason}` },
    })
  try {
    await limit(`email-confirm:${ipHash(request)}`, 20)
    const payload = readEmailChangeToken(params(request).token || '')
    if (!payload) return target('invalid')
    const person = await db
      .select()
      .from(user)
      .where(eq(user.id, payload.userId))
      .then((rows) => rows.at(0))
    if (!person || person.disabled) return target('invalid')
    if (person.emailChangeUsedAt) return target('used')
    if (person.email.toLowerCase() !== payload.fromEmail)
      return target('invalid')
    if (hasCredential(await listAccounts(person.id)))
      return target('unavailable')
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, payload.newEmail))
      .limit(1)
    if (existing.length && existing[0].id !== person.id)
      return target('invalid')
    const updated = await db
      .update(user)
      .set({
        email: payload.newEmail,
        emailVerified: true,
        emailChangeUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(user.id, person.id), isNull(user.emailChangeUsedAt)))
      .returning({ id: user.id })
    return target(updated.length ? 'ok' : 'invalid')
  } catch {
    return target('invalid')
  }
}
