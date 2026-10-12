import { useEffect, useRef } from 'react'
import type { CapSolveEvent, CapWidget } from 'cap-widget'

// React's JSX types are declared as a namespace; augmenting them is the only way
// to type the <cap-widget> custom element.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'cap-widget': React.DetailedHTMLProps<
        React.HTMLAttributes<CapWidget>,
        CapWidget
      > & { 'data-cap-api-endpoint'?: string }
    }
  }
}

/**
 * Cap proof-of-work checkbox. Reports the solved token (or null after a reset)
 * through `onToken`. Tokens are single-use: callers should remount this
 * component via `key` after each submit so the next attempt solves fresh.
 */
export function Captcha({
  endpoint,
  onToken,
}: {
  endpoint: string
  onToken: (token: string | null) => void
}) {
  const ref = useRef<CapWidget>(null)
  useEffect(() => {
    // Loaded on the client only; the package registers <cap-widget> on import.
    void import('cap-widget')
  }, [])
  useEffect(() => {
    const widget = ref.current
    if (!widget) return
    const solve = (event: CapSolveEvent) => onToken(event.detail.token)
    const reset = () => onToken(null)
    widget.addEventListener('solve', solve)
    widget.addEventListener('reset', reset)
    return () => {
      widget.removeEventListener('solve', solve)
      widget.removeEventListener('reset', reset)
    }
  }, [onToken])
  return (
    <cap-widget
      ref={ref}
      data-cap-api-endpoint={endpoint}
      data-cap-i18n-initial-state="点击完成人机验证"
      data-cap-i18n-verifying-label="正在验证…"
      data-cap-i18n-solved-label="验证通过"
      data-cap-i18n-error-label="验证失败，请重试"
      data-cap-i18n-verify-aria-label="开始人机验证"
      data-cap-i18n-verifying-aria-label="正在进行人机验证"
      data-cap-i18n-verified-aria-label="人机验证已通过"
      data-cap-i18n-error-aria-label="人机验证失败"
      data-cap-i18n-required-label="请完成人机验证"
    />
  )
}
