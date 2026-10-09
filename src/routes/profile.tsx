import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '../components/profile-page'
import { fetchSession, profileQuery } from '../lib/queries'

export const Route = createFileRoute('/profile')({
  component: ProfileRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): { emailChange?: string } => ({
    emailChange:
      typeof search.emailChange === 'string' ? search.emailChange : undefined,
  }),
  head: () => ({ meta: [{ title: '个人设置 · ASCS' }] }),
  loader: async ({ context }) => {
    const session = await fetchSession()
    if (!session.ok || !session.data)
      return { authenticated: false, userId: undefined }
    try {
      await context.queryClient.fetchQuery(profileQuery(session.data.userId))
    } catch {
      return { authenticated: false, userId: undefined }
    }
    return { authenticated: true, userId: session.data.userId }
  },
})

function ProfileRoute() {
  const { authenticated, userId } = Route.useLoaderData()
  return <ProfilePage authenticated={authenticated} initialUserId={userId} />
}
