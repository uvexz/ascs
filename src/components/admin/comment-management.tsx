import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import {
  ChatCircleIcon,
  CheckIcon,
  ShieldCheckIcon,
  TrashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { api, errorText, queryString } from '../../lib/api'
import { invalidateSiteCaches } from '../../lib/cache'
import { queryKeys } from '../../lib/query-keys'
import { profileUrl } from '../../lib/validation'
import { Avatar } from '../avatar'
import { LocalTime } from '../local-time'
import { QueryError } from '../ui'
import { BanCommenterDialog, DeleteCommentDialog } from './comment-dialogs'
import { Markdown } from '../markdown'
import { Pagination } from '../pagination'
import { StatsStrip } from './stats-strip'
import { statusLabels } from './shared'
import type { AdminComments, SiteDetail } from '../../server/api.server'
import type { CommentSearch } from '../../lib/validation'
import type { Status } from './shared'

export function CommentManagement({
  detail,
  status,
  page,
  onStateChange,
}: {
  detail: SiteDetail
  status: Status
  page: number
  onStateChange: (patch: Partial<CommentSearch>) => void
}) {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<
    AdminComments['items'][number] | null
  >(null)
  const [notice, setNotice] = useState('')
  const listKey = queryKeys.adminComments(detail.site.id, status, page)
  const list = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) =>
      api<AdminComments>(
        `sites/${detail.site.id}/comments?${queryString({ status, page })}`,
        { signal },
      ),
  })
  useEffect(() => {
    if (list.data && list.data.page !== page)
      onStateChange({ page: list.data.page })
  }, [list.data, onStateChange, page])
  async function refresh() {
    await invalidateSiteCaches(queryClient, detail.site.id)
  }
  const moderate = useMutation({
    mutationFn: (input: {
      commentId: string
      status: 'approved' | 'spam' | 'deleted'
    }) =>
      api(`sites/${detail.site.id}/comments`, { method: 'POST', body: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData<AdminComments>(listKey)
      if (previous) {
        queryClient.setQueryData<AdminComments>(listKey, {
          ...previous,
          items:
            status === 'all'
              ? previous.items.map((item) =>
                  item.id === input.commentId
                    ? { ...item, status: input.status }
                    : item,
                )
              : previous.items.filter((item) => item.id !== input.commentId),
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous)
        queryClient.setQueryData<AdminComments>(listKey, context.previous)
    },
    onSuccess: async (_, input) => {
      setDeleteId(null)
      setNotice(
        input.status === 'approved'
          ? '评论已发布。'
          : input.status === 'spam'
            ? '评论已标记为垃圾评论。'
            : '评论已删除。',
      )
      await refresh()
    },
  })
  const ban = useMutation({
    mutationFn: (input: { commentId: string; kind: 'user' | 'email' | 'ip' }) =>
      api(`sites/${detail.site.id}/bans`, { method: 'POST', body: input }),
    onSuccess: async (_, input) => {
      setBanTarget(null)
      setNotice(
        input.kind === 'ip'
          ? '已封禁该来源 IP。'
          : input.kind === 'email'
            ? '已封禁该邮箱。'
            : '已封禁该账号。',
      )
      await refresh()
    },
  })
  const setStatus = (next: Status) => {
    setNotice('')
    onStateChange({ status: next, page: 1 })
  }
  return (
    <>
      <StatsStrip detail={detail} />
      <div className="list-toolbar">
        <div className="tabs" role="toolbar" aria-label="评论状态筛选">
          {Object.entries(statusLabels).map(([value, label]) => (
            <button
              type="button"
              aria-pressed={status === value}
              key={value}
              className={status === value ? 'selected' : ''}
              onClick={() => setStatus(value as Status)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-muted">
          第 {list.data?.page || page} 页，共 {list.data?.totalPages || '—'} 页
        </span>
      </div>
      {notice && (
        <p role="status" className="success-box my-4">
          {notice}
        </p>
      )}
      {moderate.error && !deleteId && (
        <p role="alert" className="error-box my-4">
          {errorText(moderate.error)}
        </p>
      )}
      {ban.error && !banTarget && (
        <p role="alert" className="error-box my-4">
          {errorText(ban.error)}
        </p>
      )}
      {list.isPending ? (
        <p role="status" className="py-10">
          正在加载评论…
        </p>
      ) : list.error ? (
        <QueryError error={list.error} retry={list.refetch} />
      ) : !list.data.items.length ? (
        <div className="empty-state">
          <ChatCircleIcon size={36} aria-hidden="true" />
          <h2>暂无{status === 'all' ? '' : statusLabels[status]}评论</h2>
          <p>可以切换其他状态筛选查看内容。</p>
        </div>
      ) : (
        <div
          className="comment-list"
          role="region"
          tabIndex={-1}
          aria-label="评论列表"
        >
          {list.data.items.map((comment) => (
            <article key={comment.id} className="admin-comment">
              <Avatar name={comment.author} image={comment.image} />
              <div className="min-w-0 flex-1">
                <div className="comment-meta">
                  <strong className="break-words">{comment.author}</strong>
                  <span className={`badge ${comment.status}`}>
                    {statusLabels[comment.status]}
                  </span>
                  <LocalTime value={comment.createdAt} />
                </div>
                {profileUrl.safeParse(comment.pageUrl).success ? (
                  <a
                    className="article-link"
                    href={comment.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {new URL(comment.pageUrl).pathname || '/'}
                  </a>
                ) : (
                  <span className="article-link">{comment.pageUrl}</span>
                )}
                {comment.parentAuthor && (
                  <div className="parent-context">
                    <span>回复 {comment.parentAuthor}</span>
                    {comment.parentBody && (
                      <span className="line-clamp-2">{comment.parentBody}</span>
                    )}
                  </div>
                )}
                {comment.status === 'deleted' ? (
                  <p className="text-muted py-3">评论已删除</p>
                ) : (
                  <Markdown>{comment.body}</Markdown>
                )}
                {comment.spamReason && (
                  <span className="text-muted">
                    垃圾检测：
                    {comment.spamReason === 'blocked-word'
                      ? '屏蔽词'
                      : '链接过多'}
                  </span>
                )}
              </div>
              {comment.status !== 'deleted' && (
                <div className="comment-actions">
                  {comment.status !== 'approved' && (
                    <Button
                      shape="square"
                      variant="ghost"
                      aria-label="发布评论"
                      title="发布评论"
                      loading={
                        moderate.isPending &&
                        moderate.variables.commentId === comment.id
                      }
                      disabled={moderate.isPending}
                      onClick={() =>
                        moderate.mutate({
                          commentId: comment.id,
                          status: 'approved',
                        })
                      }
                    >
                      <CheckIcon size={18} />
                    </Button>
                  )}
                  {comment.status !== 'spam' && (
                    <Button
                      shape="square"
                      variant="ghost"
                      aria-label="标记垃圾评论"
                      title="标记垃圾评论"
                      loading={
                        moderate.isPending &&
                        moderate.variables.commentId === comment.id
                      }
                      disabled={moderate.isPending}
                      onClick={() =>
                        moderate.mutate({
                          commentId: comment.id,
                          status: 'spam',
                        })
                      }
                    >
                      <WarningCircleIcon size={18} />
                    </Button>
                  )}
                  <Button
                    shape="square"
                    variant="ghost"
                    aria-label="封禁评论者"
                    title="封禁评论者"
                    onClick={() => {
                      ban.reset()
                      setBanTarget(comment)
                    }}
                  >
                    <ShieldCheckIcon size={18} />
                  </Button>
                  <Button
                    shape="square"
                    variant="ghost"
                    aria-label="删除评论"
                    title="删除评论"
                    onClick={() => {
                      moderate.reset()
                      setDeleteId(comment.id)
                    }}
                  >
                    <TrashIcon size={18} />
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        setPage={(next) => onStateChange({ page: next })}
        hasMore={!!list.data?.hasMore}
        loading={list.isFetching}
        totalPages={list.data?.totalPages}
      />
      <DeleteCommentDialog
        commentId={deleteId}
        onClose={() => setDeleteId(null)}
        moderate={moderate}
      />
      <BanCommenterDialog
        target={banTarget}
        canBanIp={detail.canBanIp}
        onClose={() => setBanTarget(null)}
        ban={ban}
      />
    </>
  )
}
