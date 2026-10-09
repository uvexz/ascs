import type {} from '@tanstack/react-start'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './lib/api'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2, refetchOnWindowFocus: true } } })
  const router = createTanStackRouter({
    context: { queryClient },
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
