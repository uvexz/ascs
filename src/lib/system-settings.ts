import { z } from 'zod'

const secret = z.string().max(2000)
export const systemSettingsInput = z
  .object({
    name: z.string().trim().min(1).max(80),
    allowRegistration: z.boolean(),
    defaultSiteLimit: z.number().int().min(0).max(10000),
    smtp: z.object({
      enabled: z.boolean(),
      host: z.string().trim().max(254),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      username: z.string().max(254),
      password: secret,
      clearPassword: z.boolean().optional(),
      from: z.union([z.literal(''), z.email().max(254)]),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.smtp.enabled && (!value.smtp.host || !value.smtp.from))
      ctx.addIssue({
        code: 'custom',
        path: ['smtp'],
        message: '启用 SMTP 需要主机和发件邮箱',
      })
  })
export type SystemSettings = z.infer<typeof systemSettingsInput>
export type SafeSystemSettings = SystemSettings & {
  revision: number
  smtpPasswordSet: boolean
  smtpSource: 'database' | 'environment' | 'none'
}
export const userUpdateInput = z.object({
  name: z.string().trim().min(1).max(60),
  siteLimit: z.number().int().min(0).max(10000),
  disabled: z.boolean(),
  admin: z.boolean(),
})
export const userCreateInput = userUpdateInput.extend({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(128),
})
export type UserCreate = z.infer<typeof userCreateInput>
export type UserUpdate = z.infer<typeof userUpdateInput>
export const adminListInput = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).default(''),
  status: z
    .enum(['all', 'active', 'disabled', 'admin', 'pending', 'failed', 'sent'])
    .default('all'),
})
