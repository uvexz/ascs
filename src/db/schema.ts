import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/sqlite-core'

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' })
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  website: text('website'),
  bio: text('bio'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  siteLimit: integer('site_limit').notNull().default(0),
  disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
})
export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)
export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    index('account_user_idx').on(t.userId),
    uniqueIndex('account_provider_idx').on(t.providerId, t.accountId),
  ],
)
export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)
export const rateLimit = sqliteTable('auth_rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request', { mode: 'number' }).notNull(),
})
export const instanceAdmins = sqliteTable('instance_admins', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
})
export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  origin: text('origin').notNull().unique(),
  verificationToken: text('verification_token').notNull(),
  verifiedAt: integer('verified_at'),
  allowAnonymous: integer('allow_anonymous', { mode: 'boolean' })
    .notNull()
    .default(true),
  moderation: text('moderation', { enum: ['all', 'anonymous', 'none'] })
    .notNull()
    .default('anonymous'),
  theme: text('theme', { enum: ['auto', 'light', 'dark'] })
    .notNull()
    .default('auto'),
  notificationEmail: text('notification_email'),
  blockedWords: text('blocked_words').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
})
export const members = sqliteTable(
  'members',
  {
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'moderator'] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.siteId, t.userId] }),
    index('members_user_idx').on(t.userId),
  ],
)
export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    pageKey: text('page_key').notNull(),
    pageUrl: text('page_url').notNull(),
    parentId: text('parent_id'),
    depth: integer('depth').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    author: text('author').notNull(),
    emailHash: text('email_hash'),
    ipHash: text('ip_hash').notNull(),
    body: text('body').notNull(),
    status: text('status', {
      enum: ['pending', 'approved', 'spam', 'deleted'],
    }).notNull(),
    spamReason: text('spam_reason'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('comments_thread_idx').on(
      t.siteId,
      t.pageKey,
      t.parentId,
      t.status,
      t.createdAt,
    ),
    index('comments_moderation_idx').on(t.siteId, t.status, t.createdAt),
  ],
)
export const likes = sqliteTable(
  'likes',
  {
    commentId: text('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    voter: text('voter').notNull(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.voter] })],
)
export const bans = sqliteTable(
  'bans',
  {
    id: text('id').primaryKey(),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['user', 'email', 'ip'] }).notNull(),
    value: text('value').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('ban_unique_idx').on(t.siteId, t.kind, t.value)],
)
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    resetAt: integer('reset_at').notNull(),
  },
  (t) => [index('rate_reset_idx').on(t.resetAt)],
)
export const mailQueue = sqliteTable(
  'mail_queue',
  {
    id: text('id').primaryKey(),
    to: text('recipient').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    attempts: integer('attempts').notNull().default(0),
    availableAt: integer('available_at').notNull(),
    leaseUntil: integer('lease_until').notNull().default(0),
    leaseToken: text('lease_token'),
    sentAt: integer('sent_at'),
    lastError: text('last_error'),
  },
  (t) => [index('mail_due_idx').on(t.sentAt, t.availableAt, t.leaseUntil)],
)
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey(),
  value: text('value').notNull(),
  revision: integer('revision').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id'),
    actorName: text('actor_name').notNull(),
    action: text('action').notNull(),
    target: text('target').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt)],
)
