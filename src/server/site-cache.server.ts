import { eq } from 'drizzle-orm'
import { db } from '../db'
import { sites } from '../db/schema'

export type Site = typeof sites.$inferSelect

// A single widget page load looks the same site up three times: the CSP
// middleware needs its origin, the config request and the comments request each
// resolve it again. A short TTL collapses those into one query while keeping
// admin edits from going stale for long; the mutation paths below call
// `invalidateSite` so enable/disable and verification take effect immediately.
const TTL = 5_000
const MAX_ENTRIES = 500
const cache = new Map<string, { site: Site | null; expiresAt: number }>()

export async function siteById(id: string): Promise<Site | null> {
  const now = Date.now()
  const hit = cache.get(id)
  if (hit && hit.expiresAt > now) return hit.site
  const site = await db
    .select()
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1)
    .then((rows) => rows.at(0) ?? null)
  if (cache.size >= MAX_ENTRIES) {
    for (const [key, entry] of cache)
      if (entry.expiresAt <= now) cache.delete(key)
    if (cache.size >= MAX_ENTRIES) cache.clear()
  }
  cache.set(id, { site, expiresAt: now + TTL })
  return site
}

export function invalidateSite(id: string) {
  cache.delete(id)
}
