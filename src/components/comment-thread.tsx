import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { ArrowBendUpLeftIcon, HeartIcon } from '@phosphor-icons/react'
import { api, errorText, queryString } from '../lib/api'
import { queryKeys } from '../lib/query-keys'
import { profileUrl } from '../lib/validation'
import { Avatar } from './avatar'
import { Markdown } from './markdown'
import { Pagination } from './pagination'
import { QueryError } from './ui'
import type { CommentList } from '../server/api.server'

export type WidgetOptions = {
  siteId: string
  pageUrl: string
  pageKey?: string
  theme?: 'auto' | 'light' | 'dark'
  accent?: string
}

export function Thread({
  comment,
  options,
  sort,
  expandPath,
  onReply,
}: {
  comment: CommentList['items'][number]
  options: WidgetOptions
  sort: 'newest' | 'oldest' | 'popular'
  expandPath: string[]
  onReply: (comment: { id: string; author: string }) => void
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [liked, setLiked] = useState(comment.liked)
  const [likes, setLikes] = useState(comment.likes)
  useEffect(() => setLiked(comment.liked), [comment.liked])
  useEffect(() => setLikes(comment.likes), [comment.likes])
  useEffect(() => {
    if (expandPath.includes(comment.id)) setExpanded(true)
  }, [comment.id, expandPath])
  const replies = useQuery({
    queryKey: queryKeys.commentList({
      siteId: options.siteId,
      pageUrl: options.pageUrl,
      pageKey: options.pageKey,
      parentId: comment.id,
      sort,
      page,
    }),
    queryFn: ({ signal }) =>
      api<CommentList>(
        `comments?${queryString({ ...options, parentId: comment.id, sort, page })}`,
        { signal },
      ),
    enabled: expanded,
  })
  const like = useMutation({
    mutationFn: () =>
      api<{ liked: boolean }>('likes', {
        method: 'POST',
        body: { ...options, commentId: comment.id },
      }),
    onMutate: () => {
      const previous = { liked, likes }
      const next = !liked
      setLiked(next)
      setLikes(Math.max(0, likes + (next ? 1 : -1)))
      return previous
    },
    onError: (_error, _variables, previous) => {
      if (previous) {
        setLiked(previous.liked)
        setLikes(previous.likes)
      }
    },
    onSuccess: async (result) => {
      setLiked(result.liked)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope.comments(options.siteId),
      })
    },
  })
  return (
    <article className="thread">
      <div className="thread-main">
        <Avatar name={comment.author} image={comment.image} />
        <div className="min-w-0 flex-1">
          <div className="comment-meta">
            {comment.website &&
            profileUrl.safeParse(comment.website).success ? (
              <a
                href={comment.website}
                target="_blank"
                rel="nofollow noopener noreferrer ugc"
                className="text-link break-words font-medium"
              >
                {comment.author}
              </a>
            ) : (
              <strong className="break-words">{comment.author}</strong>
            )}
            <time>
              {new Date(comment.createdAt).toLocaleDateString('zh-CN')}
            </time>
          </div>
          {comment.status === 'deleted' ? (
            <p className="text-muted py-2">评论已删除</p>
          ) : (
            <Markdown>{comment.body}</Markdown>
          )}
          <div className="thread-actions">
            {comment.status !== 'deleted' && (
              <>
                <Button
                  variant="ghost"
                  aria-label={liked ? '取消点赞' : '点赞'}
                  aria-pressed={liked}
                  loading={like.isPending}
                  onClick={() => like.mutate()}
                >
                  <HeartIcon size={16} weight={liked ? 'fill' : 'regular'} />
                  {likes}
                </Button>
                {comment.depth < 4 && (
                  <Button
                    variant="ghost"
                    icon={ArrowBendUpLeftIcon}
                    onClick={() => onReply(comment)}
                  >
                    回复
                  </Button>
                )}
              </>
            )}
            {comment.replies > 0 && (
              <Button
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
              >
                {expanded ? '收起回复' : `${comment.replies} 条回复`}
              </Button>
            )}
          </div>
          {like.error && (
            <p role="alert" className="error-box">
              {errorText(like.error)}
            </p>
          )}
        </div>
      </div>
      {expanded && (
        <div className="replies">
          {replies.isPending ? (
            <p role="status">正在加载回复…</p>
          ) : replies.error ? (
            <QueryError error={replies.error} retry={replies.refetch} />
          ) : (
            replies.data.items.map((reply) => (
              <Thread
                key={reply.id}
                comment={reply}
                options={options}
                sort={sort}
                expandPath={expandPath}
                onReply={onReply}
              />
            ))
          )}
          <Pagination
            page={page}
            setPage={setPage}
            hasMore={!!replies.data?.hasMore}
            loading={replies.isFetching}
            totalPages={replies.data?.totalPages}
          />
        </div>
      )}
    </article>
  )
}
