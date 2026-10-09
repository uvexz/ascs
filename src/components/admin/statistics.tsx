import { StatsStrip } from './stats-strip'
import type { SiteDetail } from '../../server/api.server'

export function Statistics({ detail }: { detail: SiteDetail }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) =>
    new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 6 + index,
      ),
    )
      .toISOString()
      .slice(0, 10),
  )
  const counts = days.map(
    (day) => detail.daily.find((item) => item.day === day)?.count || 0,
  )
  const max = Math.max(1, ...counts)
  return (
    <>
      <StatsStrip detail={detail} />
      <section className="settings-section">
        <h2>最近 7 天</h2>
        <div className="bar-chart" role="list" aria-label="最近七天评论数">
          {days.map((day, index) => {
            const count = counts[index]
            return (
              <div
                key={day}
                className="chart-column"
                role="listitem"
                aria-label={`${day}，${count} 条评论`}
              >
                <span>{count}</span>
                <div className="bar-track">
                  <div
                    style={{ height: count ? `${(count / max) * 100}%` : 0 }}
                  />
                </div>
                <time>{day.slice(5)}</time>
              </div>
            )
          })}
        </div>
        <p className="text-muted">UTC · 不含已删除评论</p>
      </section>
    </>
  )
}
