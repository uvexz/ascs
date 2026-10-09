import { prepareDatabase } from './env'
await prepareDatabase()
const { db, client } = await import('../src/db/index')
const { migrate } = await import('drizzle-orm/libsql/migrator')
try {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('ASCS database migrations applied')
} finally { client.close() }
