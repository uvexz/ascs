import { createFileRoute } from '@tanstack/react-router'
import { AdminShell } from '../../components/admin-shell'
import { authSearch } from '../../lib/validation'
import { fetchSession } from '../../lib/queries'

export const Route = createFileRoute('/admin')({
  component: AdminShell,
  validateSearch: (input: Record<string, unknown>) => authSearch.parse(input),
  beforeLoad: async () => {
    const session = await fetchSession()
    return { authenticated: !!(session.ok && session.data) }
  },
})
