import { Button, Input } from '@cloudflare/kumo'
import { errorText } from '../../lib/api'
import { AppDialog } from '../ui'
import type { UseMutationResult } from '@tanstack/react-query'
import type { UserCreate, UserUpdate } from '../../lib/system-settings'
import type { InstanceUsers } from '../../server/admin.server'

type UserRow = InstanceUsers['items'][number]

export function CreateUserDialog({
  open,
  onOpenChange,
  create,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  create: UseMutationResult<unknown, Error, UserCreate>
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="创建用户"
      description="注册关闭时管理员仍可创建账号。请通过可信渠道告知用户初始密码。"
      busy={create.isPending}
    >
      <form
        key={String(open)}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          create.mutate({
            name: String(form.get('name')),
            email: String(form.get('email')),
            password: String(form.get('password')),
            siteLimit: Number(form.get('siteLimit')),
            admin: form.get('admin') === 'on',
            disabled: false,
          })
        }}
      >
        <fieldset disabled={create.isPending} className="grid gap-4">
          <Input label="昵称" name="name" required maxLength={60} />
          <Input
            label="邮箱"
            name="email"
            type="email"
            required
            maxLength={254}
          />
          <Input
            label="初始密码"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
          />
          <Input
            label="站点额度"
            name="siteLimit"
            type="number"
            defaultValue={0}
            required
            min={0}
            max={10000}
          />
          <label className="checkbox-label">
            <input type="checkbox" name="admin" />
            实例管理员
          </label>
        </fieldset>
        {create.error && (
          <p role="alert" className="error-box">
            {errorText(create.error)}
          </p>
        )}
        <Button type="submit" variant="primary" loading={create.isPending}>
          创建用户
        </Button>
      </form>
    </AppDialog>
  )
}

export function EditUserDialog({
  target,
  actorId,
  onOpenChange,
  change,
}: {
  target: UserRow | null
  actorId: string
  onOpenChange: (open: boolean) => void
  change: UseMutationResult<unknown, Error, { id: string; input: UserUpdate }>
}) {
  return (
    <AppDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="编辑用户"
      description={target?.email || ''}
      busy={change.isPending}
    >
      <form
        key={target?.id}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!target) return
          const form = new FormData(event.currentTarget)
          change.mutate({
            id: target.id,
            input: {
              name: String(form.get('name')),
              siteLimit: Number(form.get('siteLimit')),
              disabled: form.get('disabled') === 'on',
              admin: target.id === actorId || form.get('admin') === 'on',
            },
          })
        }}
      >
        <fieldset disabled={change.isPending} className="grid gap-4">
          <Input
            label="昵称"
            name="name"
            defaultValue={target?.name}
            required
            maxLength={60}
          />
          <Input
            label="站点额度"
            name="siteLimit"
            type="number"
            defaultValue={target?.siteLimit}
            min={0}
            max={10000}
            required
          />
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="admin"
              defaultChecked={target?.admin}
              disabled={target?.id === actorId}
            />
            实例管理员
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="disabled"
              defaultChecked={target?.disabled}
              disabled={target?.id === actorId}
            />
            停用账号（立即撤销登录，禁止登录和发表评论）
          </label>
        </fieldset>
        {change.error && (
          <p role="alert" className="error-box">
            {errorText(change.error)}
          </p>
        )}
        <Button type="submit" variant="primary" loading={change.isPending}>
          保存用户
        </Button>
      </form>
    </AppDialog>
  )
}

export function DeleteUserDialog({
  target,
  onOpenChange,
  remove,
}: {
  target: UserRow | null
  onOpenChange: (open: boolean) => void
  remove: UseMutationResult<unknown, Error, string>
}) {
  return (
    <AppDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="删除用户？"
      description={`将永久删除 ${target?.email || ''} 的账号、登录和成员关系。历史评论保留并匿名化；拥有站点的用户必须先转移站点。`}
      busy={remove.isPending}
      alert
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          if (target && form.get('confirmation') === target.email)
            remove.mutate(target.id)
        }}
        className="grid gap-4"
      >
        <Input
          key={target?.id}
          label="输入用户邮箱确认删除"
          name="confirmation"
          type="email"
          required
          autoComplete="off"
          onChange={(event) =>
            event.currentTarget.setCustomValidity(
              event.currentTarget.value === target?.email
                ? ''
                : '请输入待删除用户的邮箱',
            )
          }
        />
        {remove.error && (
          <p role="alert" className="error-box">
            {errorText(remove.error)}
          </p>
        )}
        <Button type="submit" variant="destructive" loading={remove.isPending}>
          永久删除用户
        </Button>
      </form>
    </AppDialog>
  )
}

export function RevokeSessionsDialog({
  target,
  onOpenChange,
  sessions,
}: {
  target: UserRow | null
  onOpenChange: (open: boolean) => void
  sessions: UseMutationResult<unknown, Error, string>
}) {
  return (
    <AppDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title="撤销所有登录？"
      description={`${target?.name || ''} 的所有设备都需要重新登录。`}
      busy={sessions.isPending}
      alert
    >
      {sessions.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(sessions.error)}
        </p>
      )}
      <Button
        variant="destructive"
        loading={sessions.isPending}
        onClick={() => target && sessions.mutate(target.id)}
      >
        撤销登录
      </Button>
    </AppDialog>
  )
}
