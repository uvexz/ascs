import { createFileRoute } from '@tanstack/react-router'
import { ApiError } from '../lib/api'
import { ProfilePage } from '../components/profile-page'
import { fetchSession, profileQuery } from '../lib/queries'

export const Route = createFileRoute('/profile')({
  component: ProfileRoute,
  head: () => ({ meta: [{ title: '个人设置 · ASCS' }] }),
  loader: async ({ context }) => {
    const session = await fetchSession()
    // Only an explicit "no session" means anonymous. A failed session check is
    // a service error: treating it as signed-out would show the login form to
    // an authenticated user whose request merely failed.
    if (!session.ok) throw new Error(session.message)
    if (!session.data) return { authenticated: false }
    try {
      await context.queryClient.fetchQuery({ ...profileQuery(), retry: 0 })
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status))
        return { authenticated: false }
      throw error
    }
    return { authenticated: true }
  },
})

function ProfileRoute() {
  const { authenticated } = Route.useLoaderData()
  return <ProfilePage authenticated={authenticated} />
}
