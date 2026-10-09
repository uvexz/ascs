import type { SiteDetail } from '../../server/api.server'

export function StatsStrip({ detail }: { detail: SiteDetail }) {
  const total = detail.stats.reduce(
    (sum, stat) => sum + (stat.status !== 'deleted' ? stat.count : 0),
    0,
  )
  return (
    <div className="stats-strip">
      {[
        { label: '评论总数', value: total, className: '' },
        {
          label: '待审核',
          value:
            detail.stats.find((stat) => stat.status === 'pending')?.count || 0,
          className: 'amber',
        },
        {
          label: '已发布',
          value:
            detail.stats.find((stat) => stat.status === 'approved')?.count || 0,
          className: 'green',
        },
        {
          label: '垃圾评论',
          value:
            detail.stats.find((stat) => stat.status === 'spam')?.count || 0,
          className: 'red',
        },
      ].map((stat) => (
        <div key={stat.label}>
          <span className="text-muted">{stat.label}</span>
          <strong className={stat.className}>
            {stat.value.toLocaleString()}
          </strong>
        </div>
      ))}
    </div>
  )
}
