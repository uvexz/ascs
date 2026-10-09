import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { api, errorText } from '../../lib/api'
import { QueryError } from '../ui'
import { Filters } from './filters'
import { ListPagination, useAdminRefresh, useList } from './shared'
import type { InstanceMail } from '../../server/admin.server'

export function Mail() {
  const list = useList<InstanceMail>('mail')
  const refresh = useAdminRefresh()
  const [notice, setNotice] = useState('')
  const change = useMutation({
    mutationFn: (id: string) =>
      api<{ sent?: number; configured?: boolean }>(
        id === 'flush' ? 'admin/mail/flush' : `admin/mail/${id}/retry`,
        { method: 'POST', body: {} },
      ),
    onSuccess: async (result, id) => {
      setNotice(
        id === 'flush'
          ? result.configured
            ? `本批次已发送 ${result.sent} 封邮件。`
            : 'SMTP 尚未启用，请先配置。'
          : '邮件已重新排队。',
      )
      await refresh()
    },
  })
  return (
    <>
      <div className="flex flex-wrap justify-between items-end gap-3">
        <Filters
          {...list}
          search={false}
          options={[
            ['all', '全部'],
            ['pending', '待发送'],
            ['failed', '重试耗尽'],
            ['sent', '已发送'],
          ]}
        />
        <Button
          className="mb-5"
          loading={change.isPending}
          onClick={() => change.mutate('flush')}
        >
          立即发送一批
        </Button>
      </div>
      <p className="text-muted mb-4">
        每批最多 20 封，失败自动重试至 5 次。持续发送需要配置定时任务。
      </p>
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      {change.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(change.error)}
        </p>
      )}
      {list.query.isPending ? (
        <p role="status">正在加载邮件队列…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <>
          <div className="data-list">
            {list.query.data.items.map((mail) => (
              <div key={mail.id} className="flex-wrap">
                <div className="min-w-0 flex-1 break-words">
                  <p>{mail.subject}</p>
                  <p className="text-muted break-all">{mail.to}</p>
                  <p className="text-muted">
                    尝试 {mail.attempts} 次 ·{' '}
                    {mail.sentAt
                      ? `发送于 ${new Date(mail.sentAt).toLocaleString('zh-CN')}`
                      : `计划 ${new Date(mail.availableAt).toLocaleString('zh-CN')}`}
                  </p>
                  {mail.lastError && (
                    <p className="text-muted">SMTP 发送失败</p>
                  )}
                </div>
                <span
                  className={`badge ${mail.sentAt ? 'approved' : mail.attempts >= 5 ? 'spam' : 'pending'}`}
                >
                  {mail.sentAt
                    ? '已发送'
                    : mail.attempts >= 5
                      ? '重试耗尽'
                      : mail.leaseUntil > Date.now()
                        ? '处理中'
                        : '待发送'}
                </span>
                {!mail.sentAt && (
                  <Button
                    disabled={change.isPending || mail.leaseUntil > Date.now()}
                    onClick={() => change.mutate(mail.id)}
                  >
                    重新排队
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!list.query.data.items.length && (
            <p className="empty-state">暂无邮件</p>
          )}
        </>
      )}
      <ListPagination list={list} />
    </>
  )
}
