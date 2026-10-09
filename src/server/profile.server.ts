import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { user } from '../db/schema'
import { profileInput } from '../lib/validation'
import { body } from './http.server'
import { check, limit, requireSession } from './security.server'

const profileFields = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  website: user.website,
  bio: user.bio,
}

export async function getProfile(request: Request) {
  const { user: person } = await requireSession(request)
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    image: person.image,
    website: person.website,
    bio: person.bio,
  }
}
export type Profile = Awaited<ReturnType<typeof getProfile>>

export async function updateProfile(request: Request) {
  const { user: person } = await requireSession(request)
  await limit(`profile:${person.id}`, 10)
  const input = profileInput.parse(await body(request))
  const updated = await db
    .update(user)
    .set({
      name: input.name,
      image: input.image || null,
      website: input.website || null,
      bio: input.bio || null,
      updatedAt: new Date(),
    })
    .where(and(eq(user.id, person.id), eq(user.disabled, false)))
    .returning(profileFields)
    .then((rows) => rows.at(0))
  check(updated, 403, '账号已停用或不存在')
  return updated
}
