import { betterAuth, APIError } from 'better-auth'
import { createAuthMiddleware } from 'better-auth/api'
import { bearer } from 'better-auth/plugins/bearer'
import { eq } from 'drizzle-orm'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db'
import * as schema from '../db/schema'
import { captchaFailure } from '../server/captcha.server'
import { enqueueMail } from '../server/mail.server'
import { readSettings } from '../server/settings.server'
import { profileInput } from './validation'

// Endpoints that accept an unauthenticated email or password guess. The Cap
// token travels in `x-cap-token`, so the password check never runs without it.
const CAPTCHA_PATHS = new Set([
  '/sign-up/email',
  '/sign-in/email',
  '/request-password-reset',
  '/forget-password',
])

export const auth = betterAuth({
  appName: 'ASCS',
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Unverified sign-ups cannot sign in, so an attacker cannot pre-register a
    // victim's address and keep that account. Changing a password also ends
    // every existing session, including any the attacker already holds.
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await enqueueMail(
        user.email,
        '重置账号密码',
        `请打开以下链接重置密码：\n${url}\n如果这不是你的操作，请忽略此邮件。`,
      )
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Existing accounts created before verification was required get a fresh
    // link the next time they try to sign in.
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      await enqueueMail(
        user.email,
        '验证你的邮箱',
        `请打开以下链接验证邮箱并完成注册：\n${url}\n如果这不是你的操作，请忽略此邮件。`,
      )
    },
  },
  socialProviders: {
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      siteLimit: { type: 'number', input: false, defaultValue: 0 },
      disabled: { type: 'boolean', input: false, defaultValue: false },
      website: { type: 'string', input: false, required: false },
      bio: { type: 'string', input: false, required: false },
    },
  },
  databaseHooks: {
    user: {
      update: {
        before: async (person) => {
          const result = profileInput
            .pick({ name: true, image: true })
            .partial()
            .safeParse({
              ...(person.name !== undefined ? { name: person.name } : {}),
              ...(person.image !== undefined
                ? { image: person.image ?? '' }
                : {}),
            })
          if (!result.success)
            throw new APIError('BAD_REQUEST', {
              message: result.error.issues[0].message,
            })
          return {
            data: {
              ...person,
              ...result.data,
              ...(result.data.image !== undefined
                ? { image: result.data.image || null }
                : {}),
            },
          }
        },
      },
      create: {
        before: async (person, context) => {
          const { settings } = await readSettings()
          if (!settings.allowRegistration && context?.request)
            throw new APIError('FORBIDDEN', {
              message: '管理员已关闭新用户注册',
            })
          return {
            data: {
              ...person,
              siteLimit: settings.defaultSiteLimit,
              disabled: false,
            },
          }
        },
      },
    },
    session: {
      create: {
        before: async (value) => {
          const person = await db
            .select({ disabled: schema.user.disabled })
            .from(schema.user)
            .where(eq(schema.user.id, value.userId))
            .then((rows) => rows.at(0))
          if (!person || person.disabled)
            throw new APIError('FORBIDDEN', { message: '账号已停用' })
          return { data: value }
        },
      },
    },
  },
  account: {
    // Provider access and id tokens are encrypted at rest with the auth secret.
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      allowDifferentEmails: true,
      trustedProviders: ['github', 'google', 'microsoft'],
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!CAPTCHA_PATHS.has(ctx.path)) return
      const failure = await captchaFailure(ctx.headers?.get('x-cap-token'))
      if (failure)
        throw new APIError(
          failure.status === 503 ? 'SERVICE_UNAVAILABLE' : 'BAD_REQUEST',
          { message: failure.message },
        )
    }),
  },
  rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
  plugins: [bearer()],
  advanced: {
    database: { generateId: 'uuid' },
    ipAddress: {
      ipAddressHeaders: process.env.TRUSTED_IP_HEADER
        ? [process.env.TRUSTED_IP_HEADER]
        : [],
    },
  },
})
