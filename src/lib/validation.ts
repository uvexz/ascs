import { z } from 'zod'

export const profileUrl = z
  .string()
  .trim()
  .max(2000, '地址最多为 2000 个字符')
  .url('请输入完整的 HTTP(S) 地址')
  .refine((value) => {
    try {
      const url = new URL(value)
      return (
        ['https:', 'http:'].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
    } catch {
      return false
    }
  }, '仅支持不含用户名和密码的 HTTP(S) 地址')
const optionalProfileUrl = z
  .string()
  .trim()
  .pipe(z.union([profileUrl, z.literal('')]))
export const profileInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, '请填写昵称')
      .max(60, '昵称最多为 60 个字符'),
    image: optionalProfileUrl,
    website: optionalProfileUrl,
    bio: z.string().trim().max(500, '简介最多为 500 个字符'),
  })
  .strict()
export type ProfileInput = z.infer<typeof profileInput>

export const emailChangeInput = z.object({ email: z.email().max(254) }).strict()

export const id = z.string().uuid()
export const adminSearch = z.object({
  site: id.optional().catch(undefined),
  view: z
    .enum([
      'comments',
      'statistics',
      'integration',
      'settings',
      'members',
      'system-overview',
      'users',
      'all-sites',
      'system-settings',
      'mail',
      'audit',
    ])
    .catch('comments'),
  status: z
    .enum(['pending', 'approved', 'spam', 'deleted', 'all'])
    .catch('pending'),
  page: z.coerce.number().int().min(1).max(10000).catch(1),
  auth: z.enum(['login', 'reset']).optional().catch(undefined),
})
export type AdminSearch = z.infer<typeof adminSearch>

export const themeSchema = z.enum(['auto', 'light', 'dark'])
const originSchema = z
  .string()
  .url()
  .max(300)
  .transform((value, context) => {
    const url = new URL(value)
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      context.addIssue({
        code: 'custom',
        message: '请填写不含路径的 HTTP(S) 站点地址',
      })
      return z.NEVER
    }
    if (
      url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      context.addIssue({ code: 'custom', message: '公开站点必须使用 HTTPS' })
      return z.NEVER
    }
    return url.origin
  })
export const siteInput = z.object({
  name: z.string().trim().min(1).max(80),
  origin: originSchema,
})
export const siteSettings = z.object({
  name: z.string().trim().min(1).max(80),
  allowAnonymous: z.boolean(),
  moderation: z.enum(['all', 'anonymous', 'none']),
  theme: themeSchema,
  notificationEmail: z
    .union([z.email().max(254), z.literal('')])
    .transform((v) => v || null),
  blockedWords: z.string().max(2000),
})
export const pageInput = z.object({
  siteId: id,
  pageUrl: z.string().url().max(2000),
  pageKey: z.string().trim().min(1).max(300).optional(),
})
export const listInput = pageInput.extend({
  parentId: id.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  sort: z.enum(['newest', 'oldest', 'popular']).default('newest'),
})
export const commentInput = pageInput.extend({
  parentId: id.optional(),
  body: z.string().trim().min(1).max(5000),
  author: z.string().trim().min(1).max(60).optional(),
  email: z.email().max(254).optional(),
  website: z.string().max(200).default(''),
  challenge: z.string().min(1).max(200),
})
export const moderationInput = z.object({
  commentId: id,
  status: z.enum(['approved', 'spam', 'deleted']),
})
export const banInput = z.object({
  commentId: id,
  kind: z.enum(['user', 'email', 'ip']),
})
export const memberInput = z.object({
  email: z.email().max(254),
  role: z.enum(['owner', 'moderator']),
  confirmOwner: z.boolean().default(false),
})
export const PAGE_SIZE = 20
export type SiteSettings = z.input<typeof siteSettings>
