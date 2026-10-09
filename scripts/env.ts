import { config } from 'dotenv'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

config({ path: ['.env.local', '.env'] })
export async function prepareDatabase() {
  const url = process.env.DATABASE_URL || 'file:./data/ascs.db'
  if (url.startsWith('file:') && url !== 'file::memory:')
    await mkdir(dirname(url.slice(5)), { recursive: true })
}
export function requireAuthConfig() {
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
  if (!process.env.BETTER_AUTH_URL)
    throw new Error('BETTER_AUTH_URL is required')
}
