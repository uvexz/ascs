import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { siteDetailQuery } from '../../../../lib/queries'
import { Statistics } from '../../../../components/admin/statistics'

export const Route = createFileRoute('/admin/site/$siteId/statistics')({
  component: StatisticsView,
})

function StatisticsView() {
  const { siteId } = Route.useParams()
  const detail = useQuery(siteDetailQuery(siteId))
  if (!detail.data) return null
  return <Statistics detail={detail.data} />
}
