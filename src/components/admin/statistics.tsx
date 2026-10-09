import { useEffect, useState } from 'react'
import { StatsStrip } from './stats-strip'
import type { SiteDetail } from '../../server/api.server'

function lastSevenUtcDays() {
  const today = new Date()
  return Array.from({ length: 7 }, (_, index) =>
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
}

export function Statistics({ detail }: { detail: SiteDetail }) {
  // Computed after mount so the server HTML and the first client render agree
  // (the server's current UTC date can differ across a midnight boundary).
  const [days, setDays] = useState<string[]>([])
  useEffect(() => {
    setDays(lastSevenUtcDays())
  }, [])
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
                <span aria-hidden="true">{count}</span>
                <div className="bar-track" aria-hidden="true">
                  <div
                    style={{ height: count ? `${(count / max) * 100}%` : 0 }}
                  />
                </div>
                <time aria-hidden="true">{day.slice(5)}</time>
              </div>
            )
          })}
        </div>
        <p className="text-muted">UTC · 不含已删除评论</p>
      </section>
    </>
  )
}
