import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { api, errorText } from '../../lib/api'
import { invalidateSiteCaches } from '../../lib/cache'
import type { SiteDetail } from '../../server/api.server'

export function Members({ detail }: { detail: SiteDetail }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState('')
  const [memberRole, setMemberRole] = useState<'owner' | 'moderator'>(
    'moderator',
  )
  const change = useMutation({
    mutationFn: (input: {
      action: 'members' | 'bans'
      method: 'POST' | 'DELETE'
      body: unknown
    }) =>
      api(`sites/${detail.site.id}/${input.action}`, {
        method: input.method,
        body: input.body,
      }),
    onSuccess: async () => {
      setNotice('操作已完成。')
      await invalidateSiteCaches(queryClient, detail.site.id)
    },
  })
  return (
    <>
      {change.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(change.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      <section className="settings-section">
        <h2>站点成员</h2>
        <div className="data-list">
          {detail.members.map((member) => (
            <div key={member.id}>
              <div className="min-w-0 break-words">
                <p>{member.name}</p>
                <p className="text-muted break-all">{member.email}</p>
              </div>
              <span className="text-muted">
                {member.role === 'owner' ? '所有者' : '审核员'}
              </span>
              {member.role === 'moderator' && (
                <Button
                  shape="square"
                  title="移除成员"
                  aria-label={`移除成员 ${member.name}`}
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({
                      action: 'members',
                      method: 'DELETE',
                      body: { userId: member.id },
                    })
                  }
                >
                  <TrashIcon size={17} />
                </Button>
              )}
            </div>
          ))}
        </div>
        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            change.mutate({
              action: 'members',
              method: 'POST',
              body: {
                email: String(form.get('email')),
                role: String(form.get('role')),
                confirmOwner: form.get('confirmOwner') === 'on',
              },
            })
            event.currentTarget.reset()
            setMemberRole('moderator')
          }}
        >
          <Input label="成员邮箱" name="email" type="email" required />
          <div>
            <label className="field-label" htmlFor="member-role">
              角色
            </label>
            <select
              id="member-role"
              name="role"
              value={memberRole}
              onChange={(event) =>
                setMemberRole(event.target.value as typeof memberRole)
              }
            >
              <option value="moderator">审核员</option>
              <option value="owner">所有者</option>
            </select>
          </div>
          {memberRole === 'owner' && (
            <label className="checkbox-label member-owner-warning">
              <input type="checkbox" name="confirmOwner" required />
              我确认授予所有者权限，并知悉当前后台无法移除所有者。
            </label>
          )}
          <Button type="submit" icon={PlusIcon} loading={change.isPending}>
            添加成员
          </Button>
        </form>
      </section>
      <section className="settings-section">
        <h2>封禁记录</h2>
        {detail.bans.length ? (
          <div className="data-list">
            {detail.bans.map((ban) => (
              <div key={ban.id}>
                <div className="min-w-0">
                  <span>
                    {ban.kind === 'user'
                      ? '账号封禁'
                      : ban.kind === 'email'
                        ? '邮箱封禁'
                        : 'IP 封禁'}
                  </span>
                  {ban.target && (
                    <p className="text-muted break-words">目标：{ban.target}</p>
                  )}
                </div>
                <time className="text-muted">
                  {new Date(ban.createdAt).toLocaleDateString('zh-CN')}
                </time>
                <Button
                  variant="ghost"
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({
                      action: 'bans',
                      method: 'DELETE',
                      body: { banId: ban.id },
                    })
                  }
                >
                  解除封禁
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">暂无封禁记录</p>
        )}
      </section>
    </>
  )
}
