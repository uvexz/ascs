import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { PlusIcon, SignOutIcon, TrashIcon } from '@phosphor-icons/react'
import { api, errorText } from '../../lib/api'
import { invalidateSiteCaches } from '../../lib/cache'
import { AppDialog } from '../ui'
import { LocalTime } from '../local-time'
import type { SiteDetail } from '../../server/api.server'

type ChangeInput = {
  action: 'members' | 'bans' | 'invitations'
  method: 'POST' | 'DELETE'
  body: unknown
}

export function Members({ detail }: { detail: SiteDetail }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState('')
  const [memberRole, setMemberRole] = useState<'owner' | 'moderator'>(
    'moderator',
  )
  const [leaveOpen, setLeaveOpen] = useState(false)
  const change = useMutation({
    mutationFn: (input: ChangeInput) =>
      api(`sites/${detail.site.id}/${input.action}`, {
        method: input.method,
        body: input.body,
      }),
    onSuccess: async (_data, variables) => {
      setNotice(
        variables.action === 'members' && variables.method === 'POST'
          ? '邀请已发送（如果邮箱已注册，对方会收到通知）。'
          : variables.action === 'invitations'
            ? '邀请已取消。'
            : variables.method === 'DELETE'
              ? '成员已移除。'
              : '操作已完成。',
      )
      setLeaveOpen(false)
      await invalidateSiteCaches(queryClient, detail.site.id)
    },
  })
  const ownerCount = detail.members.filter(
    (member) => member.role === 'owner',
  ).length
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
                <p>
                  {member.name}
                  {member.id === detail.selfId && (
                    <span className="text-muted">（你）</span>
                  )}
                </p>
                <p className="text-muted break-all">{member.email}</p>
              </div>
              <span className="text-muted">
                {member.role === 'owner' ? '所有者' : '审核员'}
              </span>
              {member.id === detail.selfId ? (
                <Button
                  variant="ghost"
                  icon={SignOutIcon}
                  disabled={change.isPending || ownerCount < 2}
                  title={
                    member.role === 'owner' && ownerCount < 2
                      ? '唯一所有者需先转移所有权'
                      : '退出此站点'
                  }
                  onClick={() => setLeaveOpen(true)}
                >
                  退出站点
                </Button>
              ) : (
                member.role === 'moderator' && (
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
                )
              )}
            </div>
          ))}
        </div>
        {detail.invitations.length > 0 && (
          <div className="data-list">
            {detail.invitations.map((invitation) => (
              <div key={invitation.id}>
                <div className="min-w-0 break-words">
                  <p>{invitation.email}</p>
                  <p className="text-muted">
                    {invitation.role === 'owner' ? '所有者' : '审核员'}邀请，
                    有效至{' '}
                    <LocalTime value={invitation.expiresAt} format="date" />
                  </p>
                </div>
                <span className="badge pending">待接受</span>
                <Button
                  shape="square"
                  title="取消邀请"
                  aria-label={`取消邀请 ${invitation.email}`}
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({
                      action: 'invitations',
                      method: 'DELETE',
                      body: { invitationId: invitation.id },
                    })
                  }
                >
                  <TrashIcon size={17} />
                </Button>
              </div>
            ))}
          </div>
        )}
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
              我确认邀请对方成为所有者；对方接受后生效。
            </label>
          )}
          <Button type="submit" icon={PlusIcon} loading={change.isPending}>
            发送邀请
          </Button>
        </form>
        <p className="text-muted mt-3">
          邀请链接 7 天内有效；只有被邀请邮箱对应的账号可以接受。
        </p>
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
                <LocalTime
                  value={ban.createdAt}
                  format="date"
                  className="text-muted"
                />
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
      <AppDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="退出站点？"
        description="退出后你将失去此站点的所有管理权限。如果你是唯一所有者，需要先转移所有权。"
        busy={change.isPending}
        alert
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            disabled={change.isPending}
            onClick={() => setLeaveOpen(false)}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={change.isPending}
            onClick={() =>
              change.mutate({
                action: 'members',
                method: 'DELETE',
                body: { userId: detail.selfId },
              })
            }
          >
            退出
          </Button>
        </div>
      </AppDialog>
    </>
  )
}
