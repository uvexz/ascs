import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@cloudflare/kumo'
import { api, errorText } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { AuthForm } from '../components/auth-form'

export const Route = createFileRoute('/widget-login')({
  ssr: false,
  head: () => ({
    meta: [
      { title: '登录 ASCS 评论' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: WidgetLogin,
})

function WidgetLogin() {
  const session = authClient.useSession()
  const [status, setStatus] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')
  const started = useRef(false)
  const state =
    typeof window === 'undefined'
      ? ''
      : new URLSearchParams(window.location.search).get('state') || ''

  const relay = useCallback(async () => {
    setStatus('busy')
    setError('')
    try {
      const result = await api<{ token: string }>('widget/session', {
        method: 'POST',
        body: {},
        skipAuth: true,
      })
      let sameOrigin = false
      try {
        sameOrigin =
          !!window.opener &&
          window.opener.location.origin === window.location.origin
      } catch {
        sameOrigin = false
      }
      if (sameOrigin)
        window.opener.postMessage(
          { type: 'ascs:widget-session', state, token: result.token },
          window.location.origin,
        )
      setStatus('done')
      window.setTimeout(() => window.close(), 400)
    } catch (errorValue) {
      setError(errorText(errorValue))
      setStatus('idle')
    }
  }, [state])

  useEffect(() => {
    if (started.current || !session.data) return
    started.current = true
    void relay()
  }, [session.data, relay])

  return (
    <main className="auth-page">
      <div className="auth-panel">
        {status === 'done' ? (
          <div className="status-copy">
            <h1 className="text-xl font-semibold">已登录</h1>
            <p role="status">评论登录状态已同步，本窗口即将关闭。</p>
            <Button onClick={() => window.close()}>关闭窗口</Button>
          </div>
        ) : session.isPending ? (
          <p role="status" className="text-muted">
            正在检查登录状态…
          </p>
        ) : session.data ? (
          <div className="status-copy">
            <h1 className="text-xl font-semibold">正在同步登录状态…</h1>
            {error ? (
              <>
                <p role="alert" className="error-box">
                  {error}
                </p>
                <Button onClick={() => void relay()}>重试</Button>
              </>
            ) : (
              <p role="status">正在完成评论登录，请稍候。</p>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">登录后发表评论</h1>
            <p className="text-muted mt-1">
              登录将在本窗口完成，成功后自动返回文章页面。
            </p>
            <AuthForm compact />
          </>
        )}
      </div>
    </main>
  )
}
