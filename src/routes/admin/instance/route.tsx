import { useEffect } from 'react'
import {
  Outlet,
  createFileRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { dashboardQuery } from '../../../lib/queries'
import { queryKeys } from '../../../lib/query-keys'
import { viewLabel } from '../../../components/admin/shared'

export const Route = createFileRoute('/admin/instance')({
  component: InstanceLayout,
  loader: async ({ context }) => {
    try {
      await context.queryClient.fetchQuery(dashboardQuery())
    } catch {
      // Unauthenticated or offline is handled by the shell and the guard below.
    }
  },
})

function InstanceLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const dashboard = useQuery(dashboardQuery())
  useEffect(() => {
    if (dashboard.data && !dashboard.data.admin)
      void navigate({ to: '/admin', replace: true })
  }, [dashboard.data, navigate])
  if (!dashboard.data) return null
  if (!dashboard.data.admin)
    return (
      <p role="alert" className="error-box">
        只有实例管理员可以访问系统管理。
      </p>
    )
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{viewLabel(pathname)}</h1>
          <p className="text-muted mt-1">
            {dashboard.data.instance.name} · 实例管理
          </p>
        </div>
        <Button
          shape="square"
          aria-label="刷新系统数据"
          title="刷新系统数据"
          onClick={() => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.scope.instance,
            })
          }}
        >
          <ArrowClockwiseIcon size={18} />
        </Button>
      </div>
      <Outlet />
    </>
  )
}
