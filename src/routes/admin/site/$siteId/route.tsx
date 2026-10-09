import { useEffect } from 'react'
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { ArrowClockwiseIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { ApiError } from '../../../../lib/api'
import { invalidateSiteCaches } from '../../../../lib/cache'
import { dashboardQuery, siteDetailQuery } from '../../../../lib/queries'
import { viewLabel } from '../../../../components/admin/shared'
import { QueryError } from '../../../../components/ui'

export const Route = createFileRoute('/admin/site/$siteId')({
  component: SiteLayout,
  loader: async ({ params, context }) => {
    try {
      await Promise.all([
        context.queryClient.fetchQuery(dashboardQuery()),
        context.queryClient.fetchQuery(siteDetailQuery(params.siteId)),
      ])
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status))
        throw redirect({ to: '/admin' })
      throw error
    }
  },
})

function SiteLayout() {
  const { siteId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const detail = useQuery(siteDetailQuery(siteId))
  useEffect(() => {
    if (
      detail.error instanceof ApiError &&
      [401, 403, 404].includes(detail.error.status)
    )
      void navigate({ to: '/admin', replace: true })
  }, [detail.error, navigate])
  if (detail.isPending)
    return (
      <p role="status" className="py-10 text-muted">
        正在加载站点数据…
      </p>
    )
  if (detail.error)
    return <QueryError error={detail.error} retry={detail.refetch} />
  const site = detail.data.site
  const label = viewLabel(pathname)
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{label}</h1>
          <p className="text-muted mt-1 break-words">{site.name}</p>
        </div>
        <Button
          shape="square"
          aria-label="刷新数据"
          title="刷新数据"
          onClick={() => void invalidateSiteCaches(queryClient, siteId)}
        >
          <ArrowClockwiseIcon size={18} />
        </Button>
      </div>
      {!site.enabled && (
        <p role="alert" className="notice-band">
          此站点已被实例管理员停用，公开评论服务不可用。
        </p>
      )}
      {!site.verifiedAt && label !== '集成' && (
        <div className="notice-band">
          <span className="h-lh flex items-center shrink-0">
            <WarningCircleIcon size={19} aria-hidden="true" />
          </span>
          <span>站点尚未验证，公开评论接口暂不可用。</span>
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: '/admin/site/$siteId/integration',
                params: { siteId },
              })
            }
          >
            验证站点
          </button>
        </div>
      )}
      <Outlet />
    </>
  )
}
