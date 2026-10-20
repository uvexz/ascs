import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './query-keys'

export function invalidateSiteCaches(client: QueryClient, siteId?: string) {
  return Promise.all([
    client.invalidateQueries({
      queryKey: siteId
        ? queryKeys.siteDetail(siteId)
        : queryKeys.scope.siteDetail,
    }),
    client.invalidateQueries({
      queryKey: queryKeys.scope.adminComments(siteId),
    }),
    client.invalidateQueries({ queryKey: queryKeys.scope.dashboard }),
  ])
}

export function invalidateInstanceCaches(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.scope.instance }),
    client.invalidateQueries({ queryKey: queryKeys.scope.dashboard }),
    client.invalidateQueries({ queryKey: queryKeys.scope.siteDetail }),
    // The instance admin can disable or delete any site, so the site switcher
    // list has to be revalidated too (it is a separate query from dashboard).
    client.invalidateQueries({ queryKey: queryKeys.scope.sitePicker }),
  ])
}

/**
 * Drop every cached query and mutation. Called on sign-in/out transitions so no
 * data from a previous account can leak across sessions.
 *
 * Note: `clear()` leaves already-mounted observers displaying their last data
 * until the next render re-registers them with the cache (at which point they
 * refetch). Every current call site triggers a render (state update, route
 * invalidation or a full page load) right after calling this helper; a future
 * caller that only resets the cache must also cause a render.
 */
export function resetAuthCaches(client: QueryClient) {
  client.clear()
}
