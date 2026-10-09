import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link
          to="/"
          search={{ view: 'comments', status: 'pending', page: 1 }}
          className="brand"
        >
          <img src="/brand.svg" alt="" width="22" height="22" />
          <span>ASCS</span>
        </Link>
        <Link
          to="/"
          search={{ view: 'comments', status: 'pending', page: 1 }}
          className="text-link"
        >
          返回管理后台
        </Link>
      </header>
      <main className="legal-main">
        <article className="legal-doc">
          <header className="legal-title">
            <h1>{title}</h1>
            <p className="text-muted">最后更新：{updatedAt}</p>
          </header>
          {children}
        </article>
      </main>
      <footer className="legal-footer">
        <span>ASCS · A Simple Comment System</span>
        <nav aria-label="法务信息">
          <Link to="/tos" className="text-link">
            服务条款
          </Link>
          <Link to="/privacy" className="text-link">
            隐私声明
          </Link>
        </nav>
      </footer>
    </div>
  )
}
