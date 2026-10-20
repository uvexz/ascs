import { createFileRoute } from '@tanstack/react-router'
import { AdminShell } from '../../components/admin-shell'
import { authSearch } from '../../lib/validation'
import { fetchSession } from '../../lib/queries'

export const Route = createFileRoute('/admin')({
  component: AdminShell,
  validateSearch: (input: Record<string, unknown>) => authSearch.parse(input),
  beforeLoad: async () => {
    const session = await fetchSession()
    // Only an explicit "no session" means anonymous. A failed session check is a
    // service error and must surface as such instead of the login form.
    if (!session.ok) throw new Error(session.message)
    return { authenticated: !!session.data }
  },
})
