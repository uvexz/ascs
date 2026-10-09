import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { api } from '../lib/api'
import type { EmailChangeResult } from '../server/profile.server'

export const Route = createFileRoute('/confirm-email-change')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: '确认修改邮箱 · ASCS' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ConfirmEmailChange,
})

const messages: Record<EmailChangeResult['status'], string> = {
  ok: '邮箱已更新，后续通知将发送到新邮箱。',
  used: '你已经使用过修改邮箱的机会。',
  invalid: '确认链接无效或已过期。',
  unavailable: '当前账号不支持修改邮箱。',
}

function ConfirmEmailChange() {
  const { token } = Route.useSearch()
  const [status, setStatus] = useState<EmailChangeResult['status'] | 'pending'>(
    token ? 'pending' : 'invalid',
  )
  useEffect(() => {
    if (!token) return
    let active = true
    api<EmailChangeResult>('profile/email/confirm', {
      method: 'POST',
      body: { token },
    })
      .then((result) => {
        if (active) setStatus(result.status)
      })
      .catch(() => {
        if (active) setStatus('invalid')
      })
    return () => {
      active = false
    }
  }, [token])
  return (
    <main className="auth-page">
      <div className="auth-panel">
        <h1 className="text-xl font-semibold">确认修改邮箱</h1>
        {status === 'pending' ? (
          <p role="status" className="text-muted mt-4">
            正在确认…
          </p>
        ) : (
          <div className="status-copy mt-4">
            <p
              role={status === 'ok' ? 'status' : 'alert'}
              className={status === 'ok' ? 'success-box' : 'error-box'}
            >
              {messages[status]}
            </p>
            <Link to="/profile" className="text-link">
              前往个人设置
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
