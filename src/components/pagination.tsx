import { Button } from '@cloudflare/kumo/components/button'
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'

export function Pagination({
  page,
  setPage,
  hasMore,
  loading,
  totalPages,
}: {
  page: number
  setPage: (page: number) => void
  hasMore: boolean
  loading: boolean
  totalPages?: number
}) {
  return (
    <nav className="pagination" aria-label="分页">
      <Button
        shape="square"
        aria-label="上一页"
        title="上一页"
        disabled={page <= 1 || loading}
        onClick={() => setPage(page - 1)}
      >
        <ArrowLeftIcon size={17} />
      </Button>
      <span aria-live="polite">
        第 {page}
        {totalPages ? ` / ${totalPages}` : ''} 页
      </span>
      <Button
        shape="square"
        aria-label="下一页"
        title="下一页"
        disabled={!hasMore || loading}
        onClick={() => setPage(page + 1)}
      >
        <ArrowRightIcon size={17} />
      </Button>
    </nav>
  )
}
