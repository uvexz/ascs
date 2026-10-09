import { createMiddleware, createStart } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { sites } from './db/schema'

const securityHeaders = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url)
  let ancestors = "'none'"
  if (url.pathname === '/widget') {
    const siteId = url.searchParams.get('siteId')
    if (siteId && /^[a-f0-9-]{36}$/.test(siteId)) {
      const [site] = await db.select({ origin: sites.origin, verifiedAt: sites.verifiedAt }).from(sites).where(eq(sites.id, siteId)).limit(1)
      if (site?.verifiedAt) ancestors = `${site.origin} 'self'`
    }
  }
  const result = await next()
  result.response.headers.set('Content-Security-Policy', `frame-ancestors ${ancestors}; object-src 'none'; base-uri 'self'; form-action 'self'`)
  result.response.headers.set('X-Content-Type-Options', 'nosniff')
  result.response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  result.response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  result.response.headers.set('Cache-Control', 'no-store')
  if (url.pathname !== '/widget') result.response.headers.set('X-Frame-Options', 'DENY')
  if (process.env.NODE_ENV === 'production' && process.env.BETTER_AUTH_URL?.startsWith('https:')) result.response.headers.set('Strict-Transport-Security', 'max-age=31536000')
  return result
})
export const startInstance = createStart(() => ({ requestMiddleware: [securityHeaders] }))
