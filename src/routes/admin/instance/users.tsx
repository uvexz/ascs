import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { dashboardQuery } from '../../../lib/queries'
import { Users } from '../../../components/instance/users'

export const Route = createFileRoute('/admin/instance/users')({
  component: UsersView,
})

function UsersView() {
  const dashboard = useQuery(dashboardQuery())
  if (!dashboard.data) return null
  return <Users actorId={dashboard.data.user.id} />
}
