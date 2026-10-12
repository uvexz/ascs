import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'
import { json } from '../../../server/http.server'
import { bearerToken } from '../../../server/security.server'

// Widget bearer sessions are only accepted by the /api/v1 comment endpoints.
// Better Auth's self-service routes (profile, linked accounts, OAuth tokens)
// must stay cookie-only, so any request carrying a bearer token is refused here.
const handle = (request: Request) =>
  bearerToken(request)
    ? json({ error: '请先登录' }, 401)
    : auth.handler(request)

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
