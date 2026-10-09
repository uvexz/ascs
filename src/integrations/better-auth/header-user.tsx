import { Link } from '@tanstack/react-router'
import { Avatar } from '#/components/avatar'
import { authClient } from '#/lib/auth-client'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="h-8 w-8 bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
    )
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/profile"
          title="个人设置"
          aria-label="个人设置"
          className="inline-flex shrink-0 rounded-md no-underline hover:ring-2 hover:ring-kumo-interact"
        >
          <Avatar name={session.user.name} image={session.user.image} />
        </Link>
        <button
          onClick={() => {
            void authClient.signOut()
          }}
          className="flex-1 h-9 px-4 font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Sign out
        </button>
      </div>
    )
  }

  return null
}
