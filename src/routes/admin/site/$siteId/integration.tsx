import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { siteDetailQuery } from '../../../../lib/queries'
import { Integration } from '../../../../components/admin/integration'

export const Route = createFileRoute('/admin/site/$siteId/integration')({
  component: IntegrationView,
})

function IntegrationView() {
  const { siteId } = Route.useParams()
  const detail = useQuery(siteDetailQuery(siteId))
  if (!detail.data) return null
  return <Integration key={siteId} detail={detail.data} />
}
