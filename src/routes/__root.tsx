import { Button } from '@cloudflare/kumo'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'ASCS · 评论管理' },
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    }),
    shellComponent: RootDocument,
    notFoundComponent: () => (
      <main className="status-page">
        <div className="status-copy">
          <h1>页面不存在</h1>
          <p>你访问的页面不存在或已经移除。</p>
          <a className="text-link" href="/">
            返回管理后台
          </a>
        </div>
      </main>
    ),
    errorComponent: ({ error, reset }) => (
      <main className="status-page">
        <div className="status-copy">
          <h1>页面加载失败</h1>
          <p role="alert">
            {error instanceof Error ? error.message : '未知错误'}
          </p>
          <Button onClick={reset}>重试</Button>
          <a className="text-link" href="/">
            返回管理后台
          </a>
        </div>
      </main>
    ),
  },
)
function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()
  return (
    <html lang="zh-CN" data-theme="kumo" data-mode="light">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
