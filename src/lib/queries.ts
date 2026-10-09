import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { ApiError } from './api'
import { queryKeys } from './query-keys'
import type { Dashboard, SiteDetail } from '../server/api.server'
import type { Profile } from '../server/profile.server'

/**
 * Server functions return a plain result envelope instead of throwing, so a
 * route loader can branch on the status on both the server and the client.
 * `unwrap` restores an `ApiError` for `useQuery` consumers.
 */
type Result<T> =
  { ok: true; data: T } | { ok: false; status: number; message: string }

function statusOf(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number(error.status)
    if (Number.isFinite(status)) return status
  }
  return undefined
}

function toResult(error: unknown): {
  ok: false
  status: number
  message: string
} {
  return {
    ok: false,
    status: statusOf(error) ?? 500,
    message:
      error instanceof Error ? error.message : '服务暂时不可用，请稍后重试。',
  }
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new ApiError(result.status, result.message)
  return result.data
}

const fetchDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Result<Dashboard>> => {
    try {
      const [{ dashboard }, { getRequest }] = await Promise.all([
        import('../server/api.server'),
        import('@tanstack/react-start/server'),
      ])
      return { ok: true, data: await dashboard(getRequest()) }
    } catch (error) {
      return toResult(error)
    }
  },
)

const fetchSiteDetail = createServerFn({ method: 'GET' })
  .validator((input: { siteId: string }) => input)
  .handler(async ({ data }): Promise<Result<SiteDetail>> => {
    try {
      const [{ siteDetail }, { getRequest }] = await Promise.all([
        import('../server/api.server'),
        import('@tanstack/react-start/server'),
      ])
      return { ok: true, data: await siteDetail(getRequest(), data.siteId) }
    } catch (error) {
      return toResult(error)
    }
  })

const fetchProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Result<Profile>> => {
    try {
      const [{ getProfile }, { getRequest }] = await Promise.all([
        import('../server/profile.server'),
        import('@tanstack/react-start/server'),
      ])
      return { ok: true, data: await getProfile(getRequest()) }
    } catch (error) {
      return toResult(error)
    }
  },
)

/** The logged-in user id for the incoming request, or `null` when anonymous. */
export const fetchSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Result<{ userId: string } | null>> => {
    try {
      const [{ getSession }, { getRequest }] = await Promise.all([
        import('../server/security.server'),
        import('@tanstack/react-start/server'),
      ])
      const session = await getSession(getRequest())
      return { ok: true, data: session ? { userId: session.user.id } : null }
    } catch (error) {
      const status = statusOf(error)
      if (status === 401 || status === 403) return { ok: true, data: null }
      return toResult(error)
    }
  },
)

export const dashboardQuery = () =>
  queryOptions({
    queryKey: queryKeys.dashboard(),
    queryFn: () => fetchDashboard().then(unwrap),
  })

export const siteDetailQuery = (siteId: string) =>
  queryOptions({
    queryKey: queryKeys.siteDetail(siteId),
    queryFn: () => fetchSiteDetail({ data: { siteId } }).then(unwrap),
  })

export const profileQuery = () =>
  queryOptions({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile().then(unwrap),
  })
