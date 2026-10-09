import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '../components/profile-page'
import { fetchSession, profileQuery } from '../lib/queries'

export const Route = createFileRoute('/profile')({
  component: ProfileRoute,
  head: () => ({ meta: [{ title: '个人设置 · ASCS' }] }),
  loader: async ({ context }) => {
    const session = await fetchSession()
    if (!session.ok || !session.data) return { authenticated: false }
    try {
      await context.queryClient.fetchQuery(profileQuery())
    } catch {
      return { authenticated: false }
    }
    return { authenticated: true }
  },
})

function ProfileRoute() {
  const { authenticated } = Route.useLoaderData()
  return <ProfilePage authenticated={authenticated} />
}
