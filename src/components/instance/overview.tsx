import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { queryKeys } from '../../lib/query-keys'
import { QueryError } from '../ui'
import type { InstanceOverview } from '../../server/admin.server'

export function Overview() {
  const query = useQuery({
    queryKey: queryKeys.instance.overview(),
    queryFn: ({ signal }) =>
      api<InstanceOverview>('admin/overview', { signal }),
  })
  if (query.isPending) return <p role="status">正在加载系统统计…</p>
  if (query.error)
    return <QueryError error={query.error} retry={query.refetch} />
  const value = query.data
  return (
    <>
      <div className="stats-strip">
        {[
          ['用户', value.users.total],
          ['站点', value.sites.total],
          [
            '待审核评论',
            value.comments.find((item) => item.status === 'pending')?.count ||
              0,
          ],
          ['发送失败邮件', value.mail.failed || 0],
        ].map(([label, count]) => (
          <div key={label}>
            <span className="text-muted">{label}</span>
            <strong>{Number(count).toLocaleString('zh-CN')}</strong>
          </div>
        ))}
      </div>
      <section className="settings-section">
        <h2>运行概况</h2>
        <dl className="definition-list">
          <div>
            <dt>停用账号</dt>
            <dd>{value.users.disabled || 0}</dd>
          </div>
          <div>
            <dt>已验证站点</dt>
            <dd>{value.sites.verified || 0}</dd>
          </div>
          <div>
            <dt>停用站点</dt>
            <dd>{value.sites.disabled || 0}</dd>
          </div>
          <div>
            <dt>等待发送邮件</dt>
            <dd>{value.mail.pending || 0}</dd>
          </div>
          <div>
            <dt>已发送邮件</dt>
            <dd>{value.mail.sent || 0}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}
