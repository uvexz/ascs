import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

const url = process.env.DATABASE_URL || 'file:./data/ascs.db'
// Vercel's filesystem is ephemeral: a local SQLite file would silently lose data.
if (process.env.VERCEL && url.startsWith('file:'))
  throw new Error('Vercel requires a remote DATABASE_URL (libsql://…).')

export const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
})
export const db = drizzle(client, { schema })
