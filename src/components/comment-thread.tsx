import { useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { ArrowBendUpLeftIcon, HeartIcon } from '@phosphor-icons/react'
import { api, errorText, queryString } from '../lib/api'
import { queryKeys } from '../lib/query-keys'
import { profileUrl } from '../lib/validation'
import { Avatar } from './avatar'
import { LocalTime } from './local-time'
import { Markdown } from './markdown'
import { QueryError } from './ui'
import type { CommentList } from '../server/api.server'

export type WidgetOptions = {
  siteId: string
  pageUrl: string
  pageKey?: string
  // Optional article context forwarded to AI moderation; never trusted for auth.
  pageTitle?: string
  pageDescription?: string
  embed?: boolean
  theme?: 'auto' | 'light' | 'dark'
  accent?: string
  border?: 'true'
  background?: string
  backgroundOpacity?: number
}

type CommentEntry = CommentList['items'][number]

/** How many extra pages a just-posted reply may pull in before it gives up. */
const REVEAL_PAGE_LIMIT = 5

export function Thread({
  comment,
  options,
  onReply,
  revealCommentId,
}: {
  comment: CommentEntry
  options: WidgetOptions
  onReply: (comment: { id: string; author: string }) => void
  // Set right after the visitor posts a reply into this discussion: the reply is
  // rendered here as soon as its page is loaded, even when the discussion is
  // longer than the first page.
  revealCommentId?: string
}) {
  // The root list is server-rendered; discussions are fetched by the browser
  // only. Starting them after mount keeps the server HTML and the hydration
  // render identical while replies still appear without any interaction.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const replies = useInfiniteQuery({
    queryKey: queryKeys.commentThread({
      siteId: options.siteId,
      pageUrl: options.pageUrl,
      pageKey: options.pageKey,
      rootId: comment.id,
    }),
    queryFn: ({ pageParam, signal }) =>
      api<CommentList>(
        `comments?${queryString({
          // Only the fields the endpoint reads; the rest of `options` is styling
          // or moderation context and is not part of the query key.
          siteId: options.siteId,
          pageUrl: options.pageUrl,
          pageKey: options.pageKey,
          rootId: comment.id,
          // A discussion reads as a conversation regardless of how the root
          // list above is sorted, so replies stay chronological.
          sort: 'oldest',
          page: pageParam,
        })}`,
        { signal },
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    // Bound memory for very long discussions; older pages drop as the visitor
    // pages forward.
    maxPages: 10,
    // `replies` counts visible direct replies; zero means there is no discussion
    // unless a reply was just posted here and the root row is still stale.
    enabled: mounted && (comment.replies > 0 || !!revealCommentId),
    // One of these queries exists per visible root comment; a focus refetch
    // would multiply requests by the number of discussions on the page.
    refetchOnWindowFocus: false,
  })
  // A refetch after posting can overlap two pages, so dedupe by id before
  // rendering rather than trusting page boundaries.
  const seen = new Set<string>()
  const replyItems: CommentEntry[] = []
  for (const page of replies.data?.pages ?? [])
    for (const item of page.items)
      if (!seen.has(item.id)) {
        seen.add(item.id)
        replyItems.push(item)
      }
  const remaining = Math.max(
    0,
    (replies.data?.pages.at(-1)?.threadTotal ?? comment.replies) -
      replyItems.length,
  )
  // A freshly posted reply may sit on a page the visitor has not opened yet, so
  // load forward until it is rendered (bounded in case it is genuinely far away).
  const revealAttempts = useRef(0)
  const revealed = useRef<string | null>(null)
  useEffect(() => {
    if (!revealCommentId) {
      revealAttempts.current = 0
      revealed.current = null
      return
    }
    if (!replies.data || replies.isFetching) return
    if (replyItems.some((item) => item.id === revealCommentId)) {
      if (revealed.current === revealCommentId) return
      revealed.current = revealCommentId
      // Top-level pages scroll to it; inside the embedded iframe the frame is as
      // tall as its content, so this is a no-op but the reply is still rendered.
      document
        .getElementById(`comment-${revealCommentId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (revealAttempts.current >= REVEAL_PAGE_LIMIT) return
    if (replies.hasNextPage && !replies.isFetchingNextPage) {
      revealAttempts.current += 1
      void replies.fetchNextPage()
    }
  }, [revealCommentId, replyItems, replies])
  const hasDiscussion = comment.replies > 0 || !!revealCommentId
  return (
    <article className="thread">
      <CommentRow comment={comment} options={options} onReply={onReply} />
      {hasDiscussion && (
        <div className="replies">
          {replies.isPending ? (
            <p className="replies-status">正在加载回复…</p>
          ) : (
            <>
              {replyItems.length > 0 ? (
                <ol
                  className="reply-list"
                  role="list"
                  aria-label={`回复 ${comment.author}`}
                >
                  {replyItems.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        options={options}
                        onReply={onReply}
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                !replies.error && <p className="replies-status">暂无可见回复</p>
              )}
              {replies.error &&
                (replyItems.length > 0 ? (
                  <p role="alert" className="error-box">
                    {errorText(replies.error)}
                  </p>
                ) : (
                  <QueryError error={replies.error} retry={replies.refetch} />
                ))}
              {replies.hasNextPage && (
                <Button
                  variant="ghost"
                  className="replies-more"
                  loading={replies.isFetchingNextPage}
                  onClick={() => void replies.fetchNextPage()}
                >
                  显示更多回复
                  {remaining > 0 ? `（还有 ${remaining} 条）` : ''}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * The like endpoint only reports the stored liked state, so patch the cached
 * root page and discussion pages instead of refetching every always-expanded
 * discussion. Both shapes share `items`.
 */
function withLike(
  data: unknown,
  commentId: string,
  liked: boolean,
  delta: number,
): unknown {
  if (!data || typeof data !== 'object') return data
  const patch = (list: CommentList): CommentList => ({
    ...list,
    items: list.items.map((item) =>
      item.id === commentId
        ? { ...item, liked, likes: Math.max(0, item.likes + delta) }
        : item,
    ),
  })
  if (Array.isArray((data as { pages?: unknown }).pages)) {
    const thread = data as { pages: CommentList[] }
    return { ...thread, pages: thread.pages.map(patch) }
  }
  if (Array.isArray((data as { items?: unknown }).items))
    return patch(data as CommentList)
  return data
}

/**
 * One comment row, used for both roots and replies. Replies keep a single
 * visual level: a reply deeper than the first level names the comment it
 * answers instead of indenting further, which keeps long discussions readable
 * inside a narrow widget.
 */
function CommentRow({
  comment,
  options,
  onReply,
}: {
  comment: CommentEntry
  options: WidgetOptions
  onReply: (comment: { id: string; author: string }) => void
}) {
  const queryClient = useQueryClient()
  const [liked, setLiked] = useState(comment.liked)
  const [likes, setLikes] = useState(comment.likes)
  useEffect(() => setLiked(comment.liked), [comment.liked])
  useEffect(() => setLikes(comment.likes), [comment.likes])
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
    onSuccess: (result, _variables, previous) => {
      setLiked(result.liked)
      // Correct the stored count as well: `result` reports the server state, so
      // a concurrent toggle cannot leave the cached number out of sync.
      const delta = (result.liked ? 1 : 0) - (previous.liked ? 1 : 0)
      queryClient.setQueriesData<unknown>(
        { queryKey: queryKeys.scope.comments(options.siteId) },
        (data: unknown) => withLike(data, comment.id, result.liked, delta),
      )
    },
  })
  // Only replies deeper than the first level need a target label; a direct
  // reply already sits under the comment it answers.
  const replyTo = comment.depth >= 2 ? comment.parentAuthor : undefined
  return (
    <div className="thread-main" id={`comment-${comment.id}`}>
      <Avatar name={comment.author} image={comment.image} />
      <div className="min-w-0 flex-1">
        <div className="comment-meta">
          {comment.website && profileUrl.safeParse(comment.website).success ? (
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
          {comment.status !== 'deleted' && comment.owner && (
            <span className="badge approved">站长</span>
          )}
          {comment.status !== 'deleted' &&
            !comment.owner &&
            comment.registered && (
              <span className="badge approved">已验证</span>
            )}
          {comment.depth >= 2 && (
            <span className="reply-context">
              <ArrowBendUpLeftIcon size={14} aria-hidden="true" />
              {replyTo ? `回复 ${replyTo}` : '回复已删除的评论'}
            </span>
          )}
          <LocalTime value={comment.createdAt} format="date" />
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
                aria-label={`点赞，${likes} 人`}
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
                  aria-label={`回复 ${comment.author}`}
                  onClick={() => onReply(comment)}
                >
                  回复
                </Button>
              )}
            </>
          )}
        </div>
        {like.error && (
          <p role="alert" className="error-box">
            {errorText(like.error)}
          </p>
        )}
      </div>
    </div>
  )
}
