import { prepareDatabase, requireAuthConfig } from './env'
import { eq } from 'drizzle-orm'
await prepareDatabase()
requireAuthConfig()
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !password || password.length < 10 || password.length > 128) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10-128 characters)')
const { db, client } = await import('../src/db/index')
const { user, instanceAdmins } = await import('../src/db/schema')
const { auth } = await import('../src/lib/auth')
try {
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1)
  // Never promote an existing account without proving possession of its password.
  const result = existing ? await auth.api.signInEmail({ body: { email, password } }) : await auth.api.signUpEmail({ body: { email, password, name: process.env.ADMIN_NAME || 'Administrator' } })
  await db.insert(instanceAdmins).values({ userId: result.user.id }).onConflictDoNothing()
  console.log(`ASCS administrator ready: ${email}`)
} finally { client.close() }
