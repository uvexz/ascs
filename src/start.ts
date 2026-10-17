import { createMiddleware, createStart } from '@tanstack/react-start'
import { captchaEndpoint } from './server/captcha.server'
import { siteById } from './server/site-cache.server'

// TanStack Start emits inline hydration/manifest scripts and this version does
// not expose a per-request nonce, so a nonce/hash-only policy would break the
// app. `'unsafe-inline'` keeps the app working; the meaningful hardening here is
// restricting script and connect sources to this origin and the Cap instance,
// while `'wasm-unsafe-eval'` lets the Cap solver compile its bundled WASM.
function contentSecurityPolicy(ancestors: string) {
  const cap = captchaEndpoint()
  let capOrigin = ''
  if (cap) {
    try {
      capOrigin = new URL(cap).origin
    } catch {
      /* Ignore a malformed CAP_SITE; captchaEndpoint already returned it. */
    }
  }
  const extra = capOrigin ? ` ${capOrigin}` : ''
  return [
    // No `default-src`: leaving unlisted resource types unrestricted avoids
    // breaking the Cap widget's child frame and other third-party embeds.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${extra}`,
    `connect-src 'self'${extra}`,
    `img-src 'self' data: https: http:`,
    `style-src 'self' 'unsafe-inline'`,
    `frame-ancestors ${ancestors}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ')
}

const securityHeaders = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url)
  let ancestors = "'none'"
  if (url.pathname === '/widget') {
    const siteId = url.searchParams.get('siteId')
    if (siteId && /^[a-f0-9-]{36}$/.test(siteId)) {
      const site = await siteById(siteId)
      if (site?.verifiedAt) ancestors = `${site.origin} 'self'`
    }
  }
  const result = await next()
  result.response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(ancestors),
  )
  result.response.headers.set('X-Content-Type-Options', 'nosniff')
  result.response.headers.set(
    'Referrer-Policy',
    'strict-origin-when-cross-origin',
  )
  result.response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )
  result.response.headers.set('Cache-Control', 'no-store')
  if (url.pathname !== '/widget')
    result.response.headers.set('X-Frame-Options', 'DENY')
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.BETTER_AUTH_URL?.startsWith('https:')
  )
    result.response.headers.set('Strict-Transport-Security', 'max-age=31536000')
  return result
})
export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders],
}))
