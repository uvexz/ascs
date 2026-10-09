import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { api } from '../../lib/api'
import { LocalTime } from '../local-time'
import { QueryError } from '../ui'
import { Filters } from './filters'
import { ListPagination, useAdminRefresh, useList } from './shared'
import {
  CreateUserDialog,
  DeleteUserDialog,
  EditUserDialog,
  RevokeSessionsDialog,
} from './user-dialogs'
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
      <CreateUserDialog
        open={creating}
        onOpenChange={setCreating}
        create={create}
      />
      <DeleteUserDialog
        target={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        remove={remove}
      />
      <EditUserDialog
        target={selected}
        actorId={actorId}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        change={change}
      />
      <RevokeSessionsDialog
        target={revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null)
        }}
        sessions={sessions}
      />
    </>
  )
}
