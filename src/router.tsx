import type {} from '@tanstack/react-start'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  dehydrate,
  hydrate,
} from '@tanstack/react-query'
import type { DehydratedState } from '@tanstack/react-query'
import { ApiError } from './lib/api'
import { queryKeys } from './lib/query-keys'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Guards the 401 revalidation loop: the dashboard refetch itself fails with
  // 401 and would otherwise re-enter the handler.
  let revalidatingAfter401 = false
  const revalidateDashboardAfter401 = (queryKeyPrefix: unknown) => {
    if (queryKeyPrefix === 'dashboard' || revalidatingAfter401) return
    revalidatingAfter401 = true
    void queryClient
      .invalidateQueries({ queryKey: queryKeys.scope.dashboard })
      .finally(() => {
        revalidatingAfter401 = false
      })
  }
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      // A 401 from any query means the session expired in the background (for
      // example a keep-alive refetch). Revalidate the dashboard so the shell
      // falls back to the login form without every page handling this itself.
      onError: (error, query) => {
        if (error instanceof ApiError && error.status === 401)
          revalidateDashboardAfter401(query.queryKey[0])
      },
    }),
    mutationCache: new MutationCache({
      // A mutation rejected with 401 means the session expired mid-action.
      // Refetch the dashboard so the shell falls back to the login form.
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401)
          revalidateDashboardAfter401(undefined)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status < 500) && count < 2,
        refetchOnWindowFocus: true,
      },
    },
  })
  const router = createTanStackRouter({
    context: { queryClient },
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Ship server-filled query data with the HTML so the client hydrates
    // without a first-paint fetch. The casts bridge the router serializer's
    // strict type check (React Query's dehydrated state is JSON-safe).
    dehydrate: () => dehydrate(queryClient) as unknown as Record<string, never>,
    hydrate: (dehydrated) =>
      hydrate(queryClient, dehydrated as unknown as DehydratedState),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
