import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

export const client = createClient({
  url: process.env.DATABASE_URL || 'file:./data/ascs.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
})
export const db = drizzle(client, { schema })
