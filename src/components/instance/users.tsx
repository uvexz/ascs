import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { api, errorText } from '../../lib/api'
import { LocalTime } from '../local-time'
import { AppDialog, QueryError } from '../ui'
import { Filters } from './filters'
import { ListPagination, useAdminRefresh, useList } from './shared'
import type { UserCreate, UserUpdate } from '../../lib/system-settings'
import type { InstanceUsers } from '../../server/admin.server'

export function Users({ actorId }: { actorId: string }) {
  const list = useList<InstanceUsers>('users')
  const refresh = useAdminRefresh()
  const [selected, setSelected] = useState<
    InstanceUsers['items'][number] | null
  >(null)
  const [revoke, setRevoke] = useState<InstanceUsers['items'][number] | null>(
    null,
  )
  const [notice, setNotice] = useState('')
  const change = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdate }) =>
      api(`admin/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: async () => {
      setSelected(null)
      setNotice('用户已更新。')
      await refresh()
    },
  })
  const sessions = useMutation({
    mutationFn: (id: string) =>
      api(`admin/users/${id}/revoke-sessions`, { method: 'POST', body: {} }),
    onSuccess: async (_, id) => {
      setRevoke(null)
      if (id === actorId) {
        window.location.assign('/')
        return
      }
      setNotice('该用户的所有登录已撤销。')
      await refresh()
    },
  })
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    InstanceUsers['items'][number] | null
  >(null)
  const create = useMutation({
    mutationFn: (input: UserCreate) =>
      api('admin/users', { method: 'POST', body: input }),
    onSuccess: async () => {
      setCreating(false)
      setNotice('用户已创建。')
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`admin/users/${id}`, { method: 'DELETE', body: {} }),
    onSuccess: async () => {
      setDeleteTarget(null)
      setNotice('用户已删除。')
      await refresh()
    },
  })
  return (
    <>
      <Button
        className="mb-4"
        onClick={() => {
          create.reset()
          setCreating(true)
        }}
      >
        创建用户
      </Button>
      <p className="text-muted mb-5">
        管理员拥有全局权限。额度按用户拥有的站点计数，降低额度不会删除已有站点。
      </p>
      <Filters
        {...list}
        options={[
          ['all', '全部'],
          ['active', '正常'],
          ['disabled', '已停用'],
          ['admin', '管理员'],
        ]}
      />
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      {list.query.isPending ? (
        <p role="status">正在加载用户…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <>
          <p className="text-muted mb-3">共 {list.query.data.total} 位用户</p>
          <div className="data-list">
            {list.query.data.items.map((person) => (
              <div key={person.id} className="flex-wrap">
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">
                    {person.name} {person.id === actorId && '（你）'}
                  </p>
                  <p className="text-muted break-all">{person.email}</p>
                  <p className="text-muted">
                    注册于 <LocalTime value={person.createdAt} format="date" />{' '}
                    · 邮箱{person.emailVerified ? '已验证' : '未验证'}
                  </p>
                </div>
                <span
                  className={`badge ${person.disabled ? 'spam' : 'approved'}`}
                >
                  {person.disabled ? '停用' : person.admin ? '管理员' : '用户'}
                </span>
                <span>
                  站点 {person.ownedSites} /{' '}
                  {person.admin ? '不限' : person.siteLimit}
                </span>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      change.reset()
                      setSelected(person)
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    onClick={() => {
                      sessions.reset()
                      setRevoke(person)
                    }}
                  >
                    撤销登录
                  </Button>
                  <Button
                    disabled={person.id === actorId}
                    onClick={() => {
                      remove.reset()
                      setDeleteTarget(person)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!list.query.data.items.length && (
            <p className="empty-state">没有匹配的用户</p>
          )}
        </>
      )}
      <ListPagination list={list} />
      <AppDialog
        open={creating}
        onOpenChange={setCreating}
        title="创建用户"
        description="注册关闭时管理员仍可创建账号。请通过可信渠道告知用户初始密码。"
        busy={create.isPending}
      >
        <form
          key={String(creating)}
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
      <AppDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="删除用户？"
        description={`将永久删除 ${deleteTarget?.email || ''} 的账号、登录和成员关系。历史评论保留并匿名化；拥有站点的用户必须先转移站点。`}
        busy={remove.isPending}
        alert
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            if (deleteTarget && form.get('confirmation') === deleteTarget.email)
              remove.mutate(deleteTarget.id)
          }}
          className="grid gap-4"
        >
          <Input
            key={deleteTarget?.id}
            label="输入用户邮箱确认删除"
            name="confirmation"
            type="email"
            required
            autoComplete="off"
            onChange={(event) =>
              event.currentTarget.setCustomValidity(
                event.currentTarget.value === deleteTarget?.email
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
          <Button
            type="submit"
            variant="destructive"
            loading={remove.isPending}
          >
            永久删除用户
          </Button>
        </form>
      </AppDialog>
      <AppDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title="编辑用户"
        description={selected?.email || ''}
        busy={change.isPending}
      >
        <form
          key={selected?.id}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selected) return
            const form = new FormData(event.currentTarget)
            change.mutate({
              id: selected.id,
              input: {
                name: String(form.get('name')),
                siteLimit: Number(form.get('siteLimit')),
                disabled: form.get('disabled') === 'on',
                admin: selected.id === actorId || form.get('admin') === 'on',
              },
            })
          }}
        >
          <fieldset disabled={change.isPending} className="grid gap-4">
            <Input
              label="昵称"
              name="name"
              defaultValue={selected?.name}
              required
              maxLength={60}
            />
            <Input
              label="站点额度"
              name="siteLimit"
              type="number"
              defaultValue={selected?.siteLimit}
              min={0}
              max={10000}
              required
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="admin"
                defaultChecked={selected?.admin}
                disabled={selected?.id === actorId}
              />
              实例管理员
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="disabled"
                defaultChecked={selected?.disabled}
                disabled={selected?.id === actorId}
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
      <AppDialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null)
        }}
        title="撤销所有登录？"
        description={`${revoke?.name || ''} 的所有设备都需要重新登录。`}
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
          onClick={() => revoke && sessions.mutate(revoke.id)}
        >
          撤销登录
        </Button>
      </AppDialog>
    </>
  )
}
