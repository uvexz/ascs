import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { GlobeIcon } from '@phosphor-icons/react'
import { Button } from '@cloudflare/kumo'
import { dashboardQuery } from '../../lib/queries'
import { queryKeys } from '../../lib/query-keys'
import { useAdminShell } from '../../components/admin-shell'
import type { Dashboard } from '../../server/api.server'

export const Route = createFileRoute('/admin/')({
  component: AdminIndex,
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.fetchQuery(dashboardQuery())
    } catch {
      return
    }
    const data = context.queryClient.getQueryData<Dashboard>(
      queryKeys.dashboard(undefined),
    )
    if (!data) return
    const site = data.sites.at(0)
    if (site)
      throw redirect({
        to: '/admin/site/$siteId/comments',
        params: { siteId: site.id },
        search: { status: 'pending', page: 1 },
        replace: true,
      })
    if (data.admin)
      throw redirect({ to: '/admin/instance/overview', replace: true })
  },
})

function AdminIndex() {
  const { openCreate } = useAdminShell()
  const dashboard = useQuery(dashboardQuery())
  if (!dashboard.data) return null
  return (
    <div className="empty-state">
      <GlobeIcon size={40} aria-hidden="true" />
      <div className="empty-copy">
        <h1>暂无站点</h1>
        <p>
          {dashboard.data.canCreateSite
            ? '添加你的第一个博客站点'
            : `当前站点额度为 ${dashboard.data.siteLimit}，请联系管理员调整额度或分配站点权限`}
        </p>
      </div>
      {dashboard.data.canCreateSite && (
        <Button variant="primary" onClick={openCreate}>
          添加站点
        </Button>
      )}
    </div>
  )
}
