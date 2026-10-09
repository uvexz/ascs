import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { api, errorText } from '../../lib/api'
import { AppDialog, QueryError } from '../ui'
import { Filters } from './filters'
import { ListPagination, useAdminRefresh, useList } from './shared'
import type { InstanceSites } from '../../server/admin.server'

export function Sites() {
  const list = useList<InstanceSites>('sites')
  const refresh = useAdminRefresh()
  const [selected, setSelected] = useState<
    InstanceSites['items'][number] | null
  >(null)
  const [transferTarget, setTransferTarget] = useState<
    InstanceSites['items'][number] | null
  >(null)
  const transfer = useMutation({
    mutationFn: (input: { id: string; email: string }) =>
      api(`admin/sites/${input.id}/transfer`, {
        method: 'POST',
        body: { email: input.email },
      }),
    onSuccess: async () => {
      setTransferTarget(null)
      await refresh()
    },
  })
  const change = useMutation({
    mutationFn: (site: InstanceSites['items'][number]) =>
      api(`admin/sites/${site.id}`, {
        method: 'PATCH',
        body: { enabled: !site.enabled },
      }),
    onSuccess: async () => {
      setSelected(null)
      await refresh()
    },
  })
  return (
    <>
      <Filters
        {...list}
        options={[
          ['all', '全部'],
          ['active', '已启用'],
          ['disabled', '已停用'],
          ['pending', '待验证'],
        ]}
      />
      {list.query.isPending ? (
        <p role="status">正在加载站点…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <>
          <p className="text-muted mb-3">共 {list.query.data.total} 个站点</p>
          <div className="data-list">
            {list.query.data.items.map((site) => (
              <div key={site.id} className="flex-wrap">
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">{site.name}</p>
                  <p className="text-muted break-all">{site.origin}</p>
                  <p className="text-muted break-words">
                    所有者：
                    {site.owners
                      .map((owner) => `${owner.name} (${owner.email})`)
                      .join('、') || '无'}
                  </p>
                </div>
                <span
                  className={`badge ${!site.enabled ? 'spam' : site.verifiedAt ? 'approved' : 'pending'}`}
                >
                  {!site.enabled
                    ? '已停用'
                    : site.verifiedAt
                      ? '已验证'
                      : '待验证'}
                </span>
                <span>{site.comments} 条评论</span>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      transfer.reset()
                      setTransferTarget(site)
                    }}
                  >
                    转移所有权
                  </Button>
                  <a
                    className="text-link self-center"
                    href={`/?site=${site.id}&view=comments`}
                  >
                    管理评论
                  </a>
                  <Button
                    onClick={() => {
                      change.reset()
                      setSelected(site)
                    }}
                  >
                    {site.enabled ? '停用' : '启用'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!list.query.data.items.length && (
            <p className="empty-state">没有匹配的站点</p>
          )}
        </>
      )}
      <ListPagination list={list} />
      <AppDialog
        open={!!transferTarget}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null)
        }}
        title="转移站点所有权"
        description="新所有者需为有效账号且额度充足。转移后原所有者失去此站点的所有者权限，审核员保持原权限。"
        busy={transfer.isPending}
      >
        <form
          key={transferTarget?.id}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            if (transferTarget)
              transfer.mutate({
                id: transferTarget.id,
                email: String(form.get('email')),
              })
          }}
        >
          <Input
            label="新所有者邮箱"
            name="email"
            type="email"
            required
            maxLength={254}
            disabled={transfer.isPending}
          />
          {transfer.error && (
            <p role="alert" className="error-box">
              {errorText(transfer.error)}
            </p>
          )}
          <Button type="submit" variant="primary" loading={transfer.isPending}>
            确认转移
          </Button>
        </form>
      </AppDialog>
      <AppDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected?.enabled ? '停用站点？' : '启用站点？'}
        description={
          selected?.enabled
            ? '停用后公开评论、提交和点赞接口不可用，历史内容保留，后台仍可管理。'
            : '启用后已通过验证的站点恢复公开评论服务。'
        }
        busy={change.isPending}
        alert
      >
        {change.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(change.error)}
          </p>
        )}
        <Button
          variant={selected?.enabled ? 'destructive' : 'primary'}
          loading={change.isPending}
          onClick={() => selected && change.mutate(selected)}
        >
          确认{selected?.enabled ? '停用' : '启用'}
        </Button>
      </AppDialog>
    </>
  )
}
