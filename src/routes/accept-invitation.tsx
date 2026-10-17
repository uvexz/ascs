import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button } from '@cloudflare/kumo'
import { api, errorText } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { resetAuthCaches } from '../lib/cache'
import { AuthForm } from '../components/auth-form'

const search = z.object({
  token: z.string().min(1).max(200).optional(),
})

export const Route = createFileRoute('/accept-invitation')({
  validateSearch: (input: Record<string, unknown>): { token?: string } => {
    const parsed = search.safeParse(input)
    return parsed.success ? parsed.data : {}
  },
  head: () => ({
    meta: [{ title: '接受站点邀请' }, { name: 'robots', content: 'noindex' }],
  }),
  component: AcceptInvitation,
})

function AcceptInvitation() {
  const { token } = Route.useSearch()
  const session = authClient.useSession()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')

  if (!token)
    return (
      <main className="auth-page">
        <div className="auth-panel">
          <h1 className="text-xl font-semibold">邀请链接无效</h1>
          <p className="text-muted mt-1">
            链接不完整或已失效，请让站点所有者重新发送邀请。
          </p>
          <a className="text-link mt-4 inline-block" href="/">
            返回控制台
          </a>
        </div>
      </main>
    )

  const inviteToken = token

  async function accept() {
    setStatus('busy')
    setError('')
    try {
      await api<{ ok: boolean; siteId: string }>('invitations/accept', {
        method: 'POST',
        body: { token: inviteToken },
      })
      resetAuthCaches(queryClient)
      setStatus('done')
    } catch (errorValue) {
      setError(errorText(errorValue))
      setStatus('idle')
    }
  }

  if (session.isPending)
    return (
      <main className="auth-page">
        <p role="status" className="text-muted">
          正在检查登录状态…
        </p>
      </main>
    )

  if (!session.data)
    return (
      <main className="auth-page">
        <div className="auth-panel">
          <h1 className="text-xl font-semibold">接受站点邀请</h1>
          <p className="text-muted mt-1">
            请使用被邀请的邮箱登录或注册，然后接受邀请。
          </p>
          <AuthForm compact />
        </div>
      </main>
    )

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <h1 className="text-xl font-semibold">接受站点邀请</h1>
        <p className="text-muted mt-1">当前账号：{session.data.user.email}</p>
        {status === 'done' ? (
          <>
            <p role="status" className="success-box mt-4">
              已加入站点。
            </p>
            <a className="text-link mt-4 inline-block" href="/">
              返回控制台
            </a>
          </>
        ) : (
          <>
            <p className="section-description mt-4">
              接受后会按邀请中的角色加入站点；所有者邀请还会检查你的站点额度。
            </p>
            {error && (
              <p role="alert" className="error-box mt-3">
                {error}
              </p>
            )}
            <Button
              className="mt-4"
              variant="primary"
              loading={status === 'busy'}
              onClick={() => void accept()}
            >
              接受邀请
            </Button>
            <a className="text-link mt-4 inline-block" href="/">
              返回控制台
            </a>
          </>
        )}
      </div>
    </main>
  )
}
