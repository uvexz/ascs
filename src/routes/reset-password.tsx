import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Input } from '@cloudflare/kumo'
import { authClient } from '../lib/auth-client'
import { errorText } from '../lib/api'

export const Route = createFileRoute('/reset-password')({
  component: ResetPassword,
})
function ResetPassword() {
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const token =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('token')
  return (
    <main className="auth-page">
      <div className="auth-panel">
        <h1 className="text-xl font-semibold">重置密码</h1>
        {done ? (
          <div className="status-copy">
            <p role="status">密码已重置。</p>
            <a className="text-link" href="/">
              返回登录
            </a>
          </div>
        ) : !token ? (
          <div className="status-copy">
            <p role="alert" className="error-box">
              此重置链接无效或已过期。
            </p>
            <a className="text-link" href="/?auth=reset">
              重新申请重置链接
            </a>
          </div>
        ) : (
          <form
            className="grid gap-4 mt-5"
            onSubmit={async (event) => {
              event.preventDefault()
              setBusy(true)
              setError('')
              const password = String(
                new FormData(event.currentTarget).get('password'),
              )
              try {
                const result = await authClient.resetPassword({
                  newPassword: password,
                  token,
                })
                if (result.error) throw new Error(result.error.message)
                setDone(true)
              } catch (errorValue) {
                setError(errorText(errorValue))
              } finally {
                setBusy(false)
              }
            }}
          >
            <Input
              label="新密码"
              description="密码长度为 10–128 个字符。"
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
            {error && (
              <p role="alert" className="error-box">
                {error}
              </p>
            )}
            <Button variant="primary" type="submit" loading={busy}>
              保存密码
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
