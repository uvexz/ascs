import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { siteDetailQuery } from '../../../../lib/queries'
import { Settings } from '../../../../components/admin/settings'
import { useAdminShell } from '../../../../components/admin-shell'

export const Route = createFileRoute('/admin/site/$siteId/settings')({
  component: SettingsView,
})

function SettingsView() {
  const { siteId } = Route.useParams()
  const navigate = useNavigate()
  const { setSettingsDirty } = useAdminShell()
  const detail = useQuery(siteDetailQuery(siteId))
  const owner = detail.data?.role === 'owner'
  useEffect(() => {
    if (detail.data && !owner)
      void navigate({
        to: '/admin/site/$siteId/comments',
        params: { siteId },
        search: { status: 'pending', page: 1 },
        replace: true,
      })
  }, [detail.data, owner, navigate, siteId])
  if (!detail.data || !owner) return null
  return (
    <Settings
      key={siteId}
      detail={detail.data}
      onDirtyChange={setSettingsDirty}
    />
  )
}
