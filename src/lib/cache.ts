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
  ])
}

/**
 * Drop every cached query and mutation. Called on sign-in/out transitions so no
 * data from a previous account can leak across sessions.
 */
export function resetAuthCaches(client: QueryClient) {
  client.clear()
}
