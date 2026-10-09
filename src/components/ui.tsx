import { Component } from 'react'
import { Button, Dialog } from '@cloudflare/kumo'
import { XIcon } from '@phosphor-icons/react'
import { ApiError, errorText } from '../lib/api'
import type { ErrorInfo, ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: unknown; failed: boolean }
> {
  state = { error: null as unknown, failed: false }
  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(
      'ASCS view failed',
      error instanceof Error ? error.name : 'UnknownError',
      info.componentStack,
    )
  }
  render() {
    if (this.state.failed)
      return (
        <div className="query-error">
          <p role="alert" className="error-box">
            {errorText(this.state.error)}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              onClick={() => this.setState({ error: null, failed: false })}
            >
              重试
            </Button>
          </div>
        </div>
      )
    return this.props.children
  }
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  busy = false,
  alert = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  children: ReactNode
  busy?: boolean
  alert?: boolean
}) {
  return (
    <Dialog.Root
      open={open}
      role={alert ? 'alertdialog' : 'dialog'}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <Dialog className="app-dialog">
        <div className="dialog-heading">
          <div className="min-w-0">
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
            <Dialog.Description className="dialog-description">
              {description}
            </Dialog.Description>
          </div>
          <Button
            shape="square"
            variant="ghost"
            aria-label="关闭弹窗"
            title="关闭弹窗"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            <XIcon size={18} />
          </Button>
        </div>
        <div className="dialog-content" aria-busy={busy}>
          {children}
        </div>
      </Dialog>
    </Dialog.Root>
  )
}

export function QueryError({
  error,
  retry,
  login,
}: {
  error: unknown
  retry: () => unknown
  login?: () => void
}) {
  return (
    <div className="query-error">
      <p role="alert" className="error-box">
        {errorText(error)}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button
          onClick={() => {
            void retry()
          }}
        >
          重试
        </Button>
        {error instanceof ApiError &&
          error.status === 401 &&
          (login ? (
            <Button variant="primary" onClick={login}>
              重新登录
            </Button>
          ) : (
            <a className="text-link" href="/">
              重新登录
            </a>
          ))}
      </div>
    </div>
  )
}

export function focusContent(element: HTMLElement | null) {
  if (!element) return
  element.focus({ preventScroll: true })
  element.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
  })
}
