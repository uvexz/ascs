import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { systemSettings } from '../db/schema'
import { systemSettingsInput } from '../lib/system-settings'
import type { SafeSystemSettings, SystemSettings } from '../lib/system-settings'

const defaults: SystemSettings = {
  name: 'ASCS',
  allowRegistration: true,
  defaultSiteLimit: 1,
  smtp: {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    from: '',
  },
}
function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32)
    throw new Error('Authentication secret is required for settings encryption')
  return createHash('sha256').update(`ascs:settings:v1:${secret}`).digest()
}
export function encryptSettings(value: SystemSettings) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ])
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64'))
    .join('.')
}
export async function readSettings(executor: Pick<typeof db, 'select'> = db) {
  const row = await executor
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.id, 1))
    .then((rows) => rows.at(0))
  if (!row)
    return { settings: structuredClone(defaults), revision: 0, saved: false }
  const [iv, tag, data] = row.value
    .split('.')
    .map((part) => Buffer.from(part, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString('utf8')
  return {
    settings: systemSettingsInput.parse(JSON.parse(plaintext)),
    revision: row.revision,
    saved: true,
  }
}
export async function safeSettings(): Promise<SafeSystemSettings> {
  const { settings, revision, saved } = await readSettings()
  return {
    ...settings,
    revision,
    smtp: { ...settings.smtp, password: '' },
    smtpPasswordSet: !!settings.smtp.password,
    smtpSource: saved
      ? 'database'
      : process.env.SMTP_URL && process.env.MAIL_FROM
        ? 'environment'
        : 'none',
  }
}
export async function publicSettings() {
  const { settings } = await readSettings()
  return { name: settings.name, allowRegistration: settings.allowRegistration }
}
