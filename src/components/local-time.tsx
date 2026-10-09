import { useEffect, useState } from 'react'

/**
 * Renders a timestamp in the visitor's locale/timezone. The formatted text is
 * produced after mount so server HTML and the first client render agree
 * (the server cannot know the browser's timezone).
 */
export function LocalTime({
  value,
  format = 'datetime',
  className,
}: {
  value: number | string | Date
  format?: 'datetime' | 'date'
  className?: string
}) {
  const date = new Date(value)
  const [text, setText] = useState('')
  useEffect(() => {
    setText(
      format === 'date'
        ? date.toLocaleDateString('zh-CN')
        : date.toLocaleString('zh-CN'),
    )
  }, [value, format])
  return (
    <time className={className} dateTime={date.toISOString()}>
      {text}
    </time>
  )
}
