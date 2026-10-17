import { prepareDatabase, requireAuthConfig } from './env'
import { and, eq } from 'drizzle-orm'

await prepareDatabase()
requireAuthConfig()
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !password || password.length < 10 || password.length > 128)
  throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10-128 characters)')
const { db, client } = await import('../src/db/index')
const { account, user, instanceAdmins } = await import('../src/db/schema')
const { auth } = await import('../src/lib/auth')
try {
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
    .then((rows) => rows.at(0))
  // Never promote an existing account without proving possession of its password.
  let result
  if (existing) {
    if (!existing.emailVerified) {
      // The operator running this script already controls the deployment, and
      // the password check below still proves ownership of the account. Marking
      // it verified avoids a deadlock when SMTP is only configurable after login.
      const context = await auth.$context
      const credential = await db
        .select()
        .from(account)
        .where(
          and(
            eq(account.userId, existing.id),
            eq(account.providerId, 'credential'),
          ),
        )
        .limit(1)
        .then((rows) => rows.at(0))
      const valid =
        !!credential?.password &&
        (await context.password.verify({
          hash: credential.password,
          password,
        }))
      if (!valid) throw new Error('Invalid email or password')
      await db
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.id, existing.id))
    }
    result = await auth.api.signInEmail({ body: { email, password } })
  } else {
    result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: process.env.ADMIN_NAME || 'Administrator',
      },
    })
    await db
      .update(user)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, result.user.id))
  }
  await db
    .insert(instanceAdmins)
    .values({ userId: result.user.id })
    .onConflictDoNothing()
  console.log(`ASCS administrator ready: ${email}`)
} finally {
  client.close()
}
