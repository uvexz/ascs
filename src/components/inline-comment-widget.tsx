import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '../lib/auth-client'
import { resetAuthCaches } from '../lib/cache'
import { AuthForm } from './auth-form'
import { Widget } from './comment-widget'
import { AppDialog } from './ui'
import type { WidgetOptions } from './comment-thread'

/**
 * The top-level (non-framed) widget. Kept in its own module so the better-auth
 * client and login form never enter the iframe bundle, which `CommentWidget`
 * only imports on demand.
 */
export function InlineCommentWidget({ options }: { options: WidgetOptions }) {
  const queryClient = useQueryClient()
  const [authOpen, setAuthOpen] = useState(false)
  const session = authClient.useSession()
  useEffect(() => {
    if (session.data) setAuthOpen(false)
  }, [session.data])
  return (
    <>
      <Widget
        options={options}
        session={session}
        onLogin={() => setAuthOpen(true)}
        onSignOut={async () => {
          const result = await authClient.signOut()
          if (result.error) return result.error.message || '退出失败'
          resetAuthCaches(queryClient)
          return null
        }}
      />
      <AppDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="登录 ASCS"
        description="登录后可以使用账号发表评论、回复和点赞。"
      >
        <AuthForm compact />
      </AppDialog>
    </>
  )
}
