import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { siteDetailQuery } from '../../../../lib/queries'
import { Members } from '../../../../components/admin/members'

export const Route = createFileRoute('/admin/site/$siteId/members')({
  component: MembersView,
})

function MembersView() {
  const { siteId } = Route.useParams()
  const navigate = useNavigate()
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
  return <Members key={siteId} detail={detail.data} />
}
