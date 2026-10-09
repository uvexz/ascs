import { createFileRoute } from '@tanstack/react-router'
import { handleApi } from '../../../server/api.server'

export const Route = createFileRoute('/api/v1/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleApi(request),
      POST: ({ request }) => handleApi(request),
      PATCH: ({ request }) => handleApi(request),
      DELETE: ({ request }) => handleApi(request),
    },
  },
})
