import type { QueryClient } from '@tanstack/react-query'

export function invalidateSiteCaches(client: QueryClient, siteId?: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['site', siteId] }),
    client.invalidateQueries({ queryKey: ['admin-comments', siteId] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}

export function invalidateInstanceCaches(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['instance-admin'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
    client.invalidateQueries({ queryKey: ['site'] }),
  ])
}
