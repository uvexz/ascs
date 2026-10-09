import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { siteDetailQuery } from '../../../../lib/queries'
import { commentSearch } from '../../../../lib/validation'
import { CommentManagement } from '../../../../components/admin/comment-management'

export const Route = createFileRoute('/admin/site/$siteId/comments')({
  validateSearch: (input: Record<string, unknown>) =>
    commentSearch.parse(input),
  component: CommentsView,
})

function CommentsView() {
  const { siteId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const detail = useQuery(siteDetailQuery(siteId))
  if (!detail.data) return null
  return (
    <CommentManagement
      key={detail.data.site.id}
      detail={detail.data}
      status={search.status}
      page={search.page}
      onStateChange={(patch) =>
        void navigate({ search: (previous) => ({ ...previous, ...patch }) })
      }
    />
  )
}
