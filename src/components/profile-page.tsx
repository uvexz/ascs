import { useEffect, useState } from 'react'
import { Link, useBlocker } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { api, ApiError, errorText, fieldError } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { profileInput } from '../lib/validation'
import { AuthForm } from './auth-form'
import { Avatar } from './avatar'
import { QueryError } from './ui'
import type { ProfileInput } from '../lib/validation'
import type { Profile } from '../server/profile.server'

export function ProfilePage() {
  const session = authClient.useSession()
  const [userId, setUserId] = useState<string>()
  useEffect(() => {
    if (session.data) setUserId(session.data.user.id)
  }, [session.data])
  const profile = useQuery({
    queryKey: ['profile', session.data?.user.id || userId],
    queryFn: ({ signal }) => api<Profile>('profile', { signal }),
    enabled: !session.isPending && !!session.data,
  })
  if (session.isPending)
    return (
      <main className="loading-page" role="status">
        正在检查登录状态…
      </main>
    )
  if (session.error && !profile.data)
    return (
      <main className="auth-page">
        <QueryError error={session.error} retry={session.refetch} />
      </main>
    )
  if (!session.data && !profile.data)
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    )
  return (
    <div className="min-h-dvh">
      <header className="topbar">
        <Link
          to="/"
          search={{ view: 'comments', status: 'pending', page: 1 }}
          className="text-link inline-flex items-start gap-2"
        >
          <span className="h-lh flex items-center shrink-0">
            <ArrowLeftIcon size={16} aria-hidden="true" />
          </span>
          <span>返回评论管理</span>
        </Link>
        <span className="font-medium">个人设置</span>
      </header>
      <main className="main-content max-w-3xl!">
        <div className="page-heading">
          <div>
            <h1>个人设置</h1>
            <p className="text-muted mt-1">管理你的昵称、头像、网站和简介。</p>
          </div>
        </div>
        {!session.data && profile.data && (
          <div className="grid gap-3 mb-6">
            <p role="alert" className="error-box">
              登录已失效，请重新登录后保存。已填写的资料会保留。
            </p>
            <AuthForm compact />
          </div>
        )}
        {profile.error && profile.data && (
          <div className="mb-6">
            <QueryError error={profile.error} retry={profile.refetch} />
          </div>
        )}
        {profile.isPending ? (
          <p role="status" className="py-10 text-muted">
            正在加载个人资料…
          </p>
        ) : profile.error && !profile.data ? (
          <QueryError error={profile.error} retry={profile.refetch} />
        ) : (
          <ProfileForm
            key={profile.data.id}
            profile={profile.data}
            refreshSession={session.refetch}
          />
        )}
      </main>
    </div>
  )
}

const editableProfile = (profile: Profile): ProfileInput => ({
  name: profile.name,
  image: profile.image || '',
  website: profile.website || '',
  bio: profile.bio || '',
})

function ProfileForm({
  profile,
  refreshSession,
}: {
  profile: Profile
  refreshSession: () => unknown
}) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(() => editableProfile(profile))
  const [draft, setDraft] = useState(saved)
  const [validationError, setValidationError] = useState<unknown>(null)
  const [notice, setNotice] = useState('')
  const dirty = (Object.keys(draft) as Array<keyof ProfileInput>).some(
    (field) => draft[field] !== saved[field],
  )
  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('个人资料尚未保存，确定要离开吗？'),
    enableBeforeUnload: dirty,
  })
  const save = useMutation({
    mutationFn: (input: ProfileInput) =>
      api<Profile>('profile', { method: 'PATCH', body: input }),
    onSuccess: async (updated) => {
      const next = editableProfile(updated)
      setSaved(next)
      setDraft(next)
      setNotice('个人资料已保存。')
      queryClient.setQueryData(['profile', profile.id], updated)
      void refreshSession()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['comments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-comments'] }),
        queryClient.invalidateQueries({ queryKey: ['site'] }),
        queryClient.invalidateQueries({
          queryKey: ['instance-admin', 'users'],
        }),
      ])
    },
  })
  const error = validationError || save.error
  useEffect(() => {
    if (!dirty && !save.isPending) {
      const next = editableProfile(profile)
      setSaved(next)
      setDraft(next)
    }
  }, [profile, dirty, save.isPending])
  function change(field: keyof ProfileInput, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setValidationError(null)
    setNotice('')
    save.reset()
  }
  return (
    <form
      className="grid gap-6"
      aria-busy={save.isPending}
      onSubmit={(event) => {
        event.preventDefault()
        if (save.isPending) return
        setNotice('')
        const parsed = profileInput.safeParse(draft)
        if (!parsed.success) {
          setValidationError(
            new ApiError(
              400,
              '请检查个人资料',
              parsed.error.issues.map((issue) => ({
                path: issue.path.map(String),
                message: issue.message,
              })),
            ),
          )
          return
        }
        setValidationError(null)
        save.mutate(parsed.data)
      }}
    >
      <div className="flex flex-col items-start gap-4 min-w-0 sm:flex-row">
        <Avatar
          name={draft.name || profile.name}
          image={draft.image}
          size={64}
        />
        <div className="grid gap-2 min-w-0 w-full flex-1">
          <Input
            label="头像地址"
            type="url"
            value={draft.image}
            onChange={(event) => change('image', event.target.value)}
            placeholder="https://example.com/avatar.png"
            description="填写可公开访问的 HTTP(S) 图片地址；留空使用默认头像，图片加载失败时自动回退。"
            maxLength={2000}
            disabled={save.isPending}
            error={fieldError(error, 'image')}
          />
          <Button
            className="justify-self-start"
            type="button"
            variant="secondary"
            disabled={save.isPending || !draft.image}
            onClick={() => change('image', '')}
          >
            恢复默认头像
          </Button>
        </div>
      </div>
      <Input
        label="昵称"
        value={draft.name}
        onChange={(event) => change('name', event.target.value)}
        autoComplete="nickname"
        description="最多 60 个字符，将显示在评论中。"
        required
        maxLength={60}
        disabled={save.isPending}
        error={fieldError(error, 'name')}
      />
      <Input
        label="邮箱"
        type="email"
        value={profile.email}
        readOnly
        description="当前账号的登录邮箱。"
      />
      <Input
        label="个人网站"
        type="url"
        value={draft.website}
        onChange={(event) => change('website', event.target.value)}
        autoComplete="url"
        placeholder="https://example.com"
        description="选填，填写后评论中的昵称会链接到此网站。"
        maxLength={2000}
        disabled={save.isPending}
        error={fieldError(error, 'website')}
      />
      <div>
        <label className="field-label" htmlFor="profile-bio">
          个人简介
        </label>
        <textarea
          id="profile-bio"
          value={draft.bio}
          onChange={(event) => change('bio', event.target.value)}
          rows={4}
          maxLength={500}
          placeholder="简单介绍一下自己"
          disabled={save.isPending}
          aria-describedby="profile-bio-hint profile-bio-error"
          aria-invalid={!!fieldError(error, 'bio')}
        />
        <p id="profile-bio-hint" className="text-muted mt-2">
          选填，最多 500 个字符（{draft.bio.length} / 500）。
        </p>
        <p id="profile-bio-error" className="mt-2 empty:hidden" role="alert">
          {fieldError(error, 'bio')}
        </p>
      </div>
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
      <div className="flex flex-wrap items-center gap-3 border-t border-kumo-line pt-5">
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
          disabled={!dirty || save.isPending}
        >
          保存资料
        </Button>
        <Button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => {
            setDraft(saved)
            setValidationError(null)
            setNotice('')
            save.reset()
          }}
        >
          重置修改
        </Button>
        {dirty && (
          <span className="text-muted" role="status">
            有未保存的修改
          </span>
        )}
      </div>
    </form>
  )
}
