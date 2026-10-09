import { useEffect, useState } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import {
  ArrowRightIcon,
  GithubLogoIcon,
  GoogleLogoIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react'
import { authClient } from '../lib/auth-client'
import { api, errorText, fieldError } from '../lib/api'

export function AuthForm({
  compact = false,
  initialMode = 'login',
  inFrame = false,
}: {
  compact?: boolean
  initialMode?: 'login' | 'signup' | 'reset'
  inFrame?: boolean
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const providers = useQuery({
    queryKey: ['auth-config'],
    queryFn: () =>
      api<{
        github: boolean
        google: boolean
        microsoft: boolean
        name: string
        allowRegistration: boolean
      }>('auth-config'),
  })
  useEffect(() => {
    if (providers.data)
      document.title = `${providers.data.name} · ${mode === 'signup' ? '注册' : mode === 'reset' ? '重置密码' : '登录'}`
    if (providers.data?.allowRegistration === false && mode === 'signup')
      setMode('login')
  }, [providers.data, mode])
  useEffect(() => {
    setError(null)
    setNotice('')
  }, [mode])
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice('')
    const form = new FormData(event.currentTarget)
    try {
      const email = String(form.get('email'))
      const password = String(form.get('password'))
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({
              email,
              password,
              name: String(form.get('name')),
            })
          : mode === 'reset'
            ? await authClient.requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`,
              })
            : await authClient.signIn.email({ email, password })
      if (result.error) throw new Error(result.error.message || '认证失败')
      if (mode === 'reset') setNotice('若账号存在，重置链接将发送到你的邮箱。')
      else await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (errorValue) {
      setError(errorValue)
    } finally {
      setBusy(false)
    }
  }
  async function social(provider: 'github' | 'google' | 'microsoft') {
    setBusy(true)
    setError(null)
    try {
      if (inFrame) {
        const popup = window.open('about:blank', '_blank')
        if (!popup)
          throw new Error('浏览器阻止了登录窗口，请允许弹出窗口后重试。')
        const result = await authClient.signIn.social({
          provider,
          callbackURL: window.location.href,
          disableRedirect: true,
        })
        const url = result.data?.url
        if (result.error || !url) {
          popup.close()
          throw new Error(result.error?.message || '无法获取第三方登录地址')
        }
        popup.location.replace(url)
        return
      }
      const result = await authClient.signIn.social({
        provider,
        callbackURL: window.location.href,
      })
      if (result.error) throw new Error(result.error.message)
    } catch (errorValue) {
      setError(errorValue)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={compact ? 'auth-compact' : 'auth-panel'}>
      {!compact && (
        <>
          <img src="/brand.svg" width="48" height="48" alt="ASCS" />
          <h1 className="mt-5 text-2xl font-semibold">
            {providers.data?.name || 'ASCS'}
          </h1>
          <p className="text-muted mt-1">
            {mode === 'signup'
              ? '创建账号'
              : mode === 'reset'
                ? '重置密码'
                : '登录评论管理'}
          </p>
        </>
      )}
      {compact && (
        <h3 className="font-semibold mb-3">
          {mode === 'signup'
            ? '创建账号'
            : mode === 'reset'
              ? '重置密码'
              : '登录'}
        </h3>
      )}
      <form onSubmit={submit} className="grid gap-4 mt-6">
        {mode === 'signup' && (
          <Input
            label="昵称"
            name="name"
            autoComplete="nickname"
            required
            maxLength={60}
            error={fieldError(error, 'name')}
          />
        )}
        <Input
          label="邮箱"
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          error={fieldError(error, 'email')}
        />
        {mode !== 'reset' && (
          <Input
            label="密码"
            description="密码长度为 10–128 个字符。"
            type="password"
            name="password"
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
            required
            minLength={10}
            maxLength={128}
            error={fieldError(error, 'password')}
          />
        )}
        {error != null && (
          <p role="alert" className="error-box">
            {errorText(error)}
          </p>
        )}
        {notice && (
          <p role="status" className="success-box">
            {notice}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy}>
          {mode === 'signup'
            ? '创建账号'
            : mode === 'reset'
              ? '发送重置链接'
              : '登录'}
          <ArrowRightIcon size={16} />
        </Button>
      </form>
      {providers.error && mode !== 'reset' && (
        <p role="alert" className="text-muted mt-4">
          第三方登录暂时不可用，你仍可以使用邮箱登录。
        </p>
      )}
      {(providers.data?.github ||
        providers.data?.google ||
        providers.data?.microsoft) &&
        mode !== 'reset' && (
          <>
            <div className="flex flex-wrap gap-2 mt-4">
              {providers.data.github && (
                <Button
                  className="flex-1"
                  onClick={() => social('github')}
                  disabled={busy}
                >
                  <GithubLogoIcon size={18} />
                  GitHub
                </Button>
              )}
              {providers.data.google && (
                <Button
                  className="flex-1"
                  onClick={() => social('google')}
                  disabled={busy}
                >
                  <GoogleLogoIcon size={18} />
                  Google
                </Button>
              )}
              {providers.data.microsoft && (
                <Button
                  className="flex-1"
                  onClick={() => social('microsoft')}
                  disabled={busy}
                >
                  <SquaresFourIcon size={18} />
                  Microsoft
                </Button>
              )}
            </div>
            {inFrame && (
              <p className="text-muted mt-2">
                第三方登录将在新窗口中完成授权。
              </p>
            )}
          </>
        )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-muted">
        {(providers.data?.allowRegistration || mode === 'signup') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          >
            {mode === 'signup' ? '已有账号，登录' : '创建账号'}
          </button>
        )}
        {providers.data?.allowRegistration === false && (
          <span>新用户注册已关闭</span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode(mode === 'reset' ? 'login' : 'reset')}
        >
          {mode === 'reset' ? '返回登录' : '忘记密码'}
        </button>
      </div>
    </div>
  )
}
