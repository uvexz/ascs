import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { api, errorText, fieldError } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { queryKeys, staleTimes } from '../lib/query-keys'
import { AUTH_PROVIDERS } from './auth-providers'
import { AppDialog, QueryError } from './ui'
import type { AuthProviderId } from './auth-providers'
import type { ProfileAccounts } from '../server/profile.server'

type AuthConfig = { github: boolean; google: boolean; microsoft: boolean }

export function ProfileSecurity({ email }: { email: string }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<AuthProviderId | null>(null)
  const [bindError, setBindError] = useState<unknown>(null)
  const [unlinkError, setUnlinkError] = useState<unknown>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<{
    id: string
    providerId: AuthProviderId
  } | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [notice, setNotice] = useState('')
  const config = useQuery({
    queryKey: queryKeys.authConfig(),
    queryFn: () => api<AuthConfig>('auth-config'),
    staleTime: staleTimes.static,
  })
  const accounts = useQuery({
    queryKey: queryKeys.profileAccounts(),
    queryFn: () => api<ProfileAccounts>('profile/accounts'),
  })
  const changeEmail = useMutation({
    mutationFn: (value: string) =>
      api('profile/email', { method: 'POST', body: { email: value } }),
    onSuccess: () => {
      setNotice(
        '确认链接已发送到新邮箱，请在一小时内点击邮件中的链接完成修改。',
      )
      setNewEmail('')
    },
  })
  const providers = AUTH_PROVIDERS.filter(
    (provider) => config.data?.[provider.id],
  )
  const linked = (accounts.data?.accounts || []).filter(
    (item) => item.providerId !== 'credential',
  )
  async function bind(provider: AuthProviderId) {
    setBusy(provider)
    setBindError(null)
    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: window.location.href,
      })
      if (result.error) throw new Error(result.error.message || '无法绑定')
    } catch (errorValue) {
      setBindError(errorValue)
      setBusy(null)
    }
  }
  async function unlink() {
    if (!unlinkTarget) return
    setBusy(unlinkTarget.providerId)
    setUnlinkError(null)
    try {
      const result = await authClient.unlinkAccount({
        accountId: unlinkTarget.id,
      })
      if (result.error) throw new Error(result.error.message || '解绑失败')
      setUnlinkTarget(null)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profileAccounts(),
      })
    } catch (errorValue) {
      setUnlinkError(errorValue)
    } finally {
      setBusy(null)
    }
  }
  if (accounts.isPending)
    return (
      <p role="status" className="py-6 text-muted">
        正在加载账号信息…
      </p>
    )
  if (accounts.error)
    return <QueryError error={accounts.error} retry={accounts.refetch} />
  return (
    <>
      <section className="settings-section">
        <h2>第三方登录</h2>
        <p className="section-description">
          绑定后可以使用对应的第三方账号登录，也可以随时在此解绑。
        </p>
        {providers.length === 0 ? (
          <p className="text-muted">未启用第三方登录。</p>
        ) : (
          <div className="data-list">
            {providers.map((provider) => {
              const account = linked.find(
                (item) => item.providerId === provider.id,
              )
              return (
                <div key={provider.id} className="flex-wrap">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="h-lh flex shrink-0 items-center">
                      <provider.Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 break-words">{provider.name}</span>
                  </div>
                  <span className={`badge ${account ? 'approved' : 'pending'}`}>
                    {account ? '已绑定' : '未绑定'}
                  </span>
                  {account ? (
                    <Button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        setUnlinkError(null)
                        setUnlinkTarget({
                          id: account.id,
                          providerId: provider.id,
                        })
                      }}
                    >
                      解绑
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={!!busy}
                      loading={busy === provider.id}
                      onClick={() => bind(provider.id)}
                    >
                      绑定
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {bindError != null && (
          <p role="alert" className="error-box mt-3">
            {errorText(bindError)}
          </p>
        )}
      </section>
      {!accounts.data.hasPassword && (
        <section className="settings-section">
          <h2>修改邮箱</h2>
          {accounts.data.emailChangeUsedAt ? (
            <p className="section-description">
              你已经使用过修改邮箱的机会。当前邮箱为 {email}。
            </p>
          ) : (
            <>
              <p className="section-description">
                第三方登录创建的账号可以修改一次邮箱，用于接收评论通知。提交后会向新邮箱发送确认链接，点击后才会生效。
              </p>
              <form
                className="form-width grid gap-4"
                aria-busy={changeEmail.isPending}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (changeEmail.isPending) return
                  setNotice('')
                  changeEmail.mutate(newEmail)
                }}
              >
                <Input
                  label="新邮箱"
                  type="email"
                  value={newEmail}
                  onChange={(event) => {
                    setNewEmail(event.target.value)
                    setNotice('')
                    changeEmail.reset()
                  }}
                  autoComplete="email"
                  required
                  maxLength={254}
                  disabled={changeEmail.isPending}
                  description={`当前邮箱：${email}。仅可修改一次，请确认填写正确。`}
                  error={fieldError(changeEmail.error, 'email')}
                />
                {changeEmail.error != null && (
                  <p role="alert" className="error-box">
                    {errorText(changeEmail.error)}
                  </p>
                )}
                {notice && (
                  <p role="status" className="success-box">
                    {notice}
                  </p>
                )}
                <Button
                  className="justify-self-start"
                  type="submit"
                  variant="primary"
                  loading={changeEmail.isPending}
                  disabled={!newEmail || changeEmail.isPending}
                >
                  发送确认链接
                </Button>
              </form>
            </>
          )}
        </section>
      )}
      <AppDialog
        open={!!unlinkTarget}
        onOpenChange={(next) => {
          if (!next) setUnlinkTarget(null)
        }}
        title="解绑第三方登录？"
        description={
          unlinkTarget
            ? `解绑后将无法再用 ${
                AUTH_PROVIDERS.find(
                  (provider) => provider.id === unlinkTarget.providerId,
                )?.name || '该账号'
              } 登录。`
            : ''
        }
        busy={!!busy}
        alert
      >
        <div>
          {unlinkError != null && (
            <p role="alert" className="error-box mb-4">
              {errorText(unlinkError)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              disabled={!!busy}
              onClick={() => setUnlinkTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={!!busy}
              onClick={unlink}
            >
              解绑
            </Button>
          </div>
        </div>
      </AppDialog>
    </>
  )
}
