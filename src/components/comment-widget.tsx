import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, LinkButton } from '@cloudflare/kumo'
import {
  ChatCircleIcon,
  GearSixIcon,
  SignInIcon,
  SignOutIcon,
} from '@phosphor-icons/react'
import { api, errorText, queryString } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { resetAuthCaches } from '../lib/cache'
import { queryKeys, staleTimes } from '../lib/query-keys'
import {
  clearWidgetToken,
  getWidgetToken,
  setWidgetToken,
  useWidgetSession,
} from '../lib/widget-session'
import { AuthForm } from './auth-form'
import { Avatar } from './avatar'
import { CommentComposer } from './comment-composer'
import { Thread } from './comment-thread'
import { AppDialog, QueryError, focusContent } from './ui'
import { Pagination } from './pagination'
import type { WidgetOptions } from './comment-thread'
import type { CommentList, CommentLocation } from '../server/api.server'

type Config = {
  name: string
  allowAnonymous: boolean
  theme: 'auto' | 'light' | 'dark'
  challenge: string
}

type WidgetSession = {
  data: { user: { id: string; name: string; image?: string | null } } | null
  isPending: boolean
}

/**
 * Chooses the session strategy up front so the cookie-based session hook only
 * mounts on a top-level page. Inside a cross-origin iframe the cookie session is
 * unreachable, so that branch talks to the short-lived widget bearer session
 * instead and never issues the cookie request.
 */
export function CommentWidget({ options }: { options: WidgetOptions }) {
  const embedded = typeof window !== 'undefined' && window.parent !== window
  return embedded ? (
    <EmbeddedCommentWidget options={options} />
  ) : (
    <InlineCommentWidget options={options} />
  )
}

function InlineCommentWidget({ options }: { options: WidgetOptions }) {
  const queryClient = useQueryClient()
  const [authOpen, setAuthOpen] = useState(false)
  const session = authClient.useSession()
  useEffect(() => {
    if (session.data) setAuthOpen(false)
  }, [session.data])
  return (
    <>
      <Widget
        options={options}
        session={session}
        onLogin={() => setAuthOpen(true)}
        onSignOut={async () => {
          const result = await authClient.signOut()
          if (result.error) return result.error.message || '退出失败'
          resetAuthCaches(queryClient)
          return null
        }}
      />
      <AppDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        title="登录 ASCS"
        description="登录后可以使用账号发表评论、回复和点赞。"
      >
        <AuthForm compact />
      </AppDialog>
    </>
  )
}

function EmbeddedCommentWidget({ options }: { options: WidgetOptions }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : getWidgetToken(),
  )
  const [loginError, setLoginError] = useState('')
  const popupRef = useRef<Window | null>(null)
  const nonceRef = useRef('')
  const widgetSession = useWidgetSession(token)
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== popupRef.current ||
        !event.data ||
        event.data.type !== 'ascs:widget-session' ||
        event.data.state !== nonceRef.current ||
        typeof event.data.token !== 'string' ||
        !event.data.token
      )
        return
      setWidgetToken(event.data.token)
      setToken(event.data.token)
      popupRef.current?.close()
      popupRef.current = null
      setLoginError('')
      void queryClient.invalidateQueries({
        queryKey: queryKeys.scope.widgetSession,
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.scope.comments(options.siteId),
      })
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [queryClient, options.siteId])
  const openLogin = useCallback(() => {
    const nonce = crypto.randomUUID()
    nonceRef.current = nonce
    const url = new URL('/widget-login', window.location.origin)
    url.searchParams.set('state', nonce)
    const popup = window.open(
      url.href,
      'ascs-widget-login',
      'popup,width=480,height=640',
    )
    if (!popup) {
      setLoginError('浏览器阻止了登录窗口，请允许弹出窗口后重试。')
      return
    }
    popupRef.current = popup
  }, [])
  return (
    <Widget
      options={options}
      session={widgetSession}
      loginError={loginError}
      onLogin={openLogin}
      onSignOut={async () => {
        let warning: string | null = null
        try {
          await api('widget/session', { method: 'DELETE', body: {} })
        } catch {
          warning = '退出请求未送达，已在本地退出。'
        }
        clearWidgetToken()
        setToken(null)
        resetAuthCaches(queryClient)
        return warning
      }}
    />
  )
}

function Widget({
  options,
  session,
  onLogin,
  onSignOut,
  loginError = '',
}: {
  options: WidgetOptions
  session: WidgetSession
  onLogin: () => void
  onSignOut: () => Promise<string | null>
  loginError?: string
}) {
  const queryClient = useQueryClient()
  const config = useQuery({
    queryKey: queryKeys.widgetConfig(
      options.siteId,
      options.pageUrl,
      options.pageKey,
      options.theme,
      options.accent,
    ),
    queryFn: ({ signal }) =>
      api<Config>(`config?${queryString(options)}`, { signal }),
    staleTime: staleTimes.static,
  })
  const [reply, setReply] = useState<{ id: string; author: string } | null>(
    null,
  )
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'popular'>('newest')
  const [page, setPage] = useState(1)
  const [expandPath, setExpandPath] = useState<string[]>([])
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    options.theme === 'dark' ||
    (!options.theme &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light',
  )
  const textRef = useRef(text)
  const replyRef = useRef(reply)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    textRef.current = text
  }, [text])
  useEffect(() => {
    replyRef.current = reply
  }, [reply])
  const theme = options.theme || config.data?.theme || 'auto'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      const next = theme === 'auto' ? (media.matches ? 'dark' : 'light') : theme
      setMode(next)
      document.documentElement.dataset.mode = next
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])
  useEffect(() => {
    if (window.parent === window) return
    let origin: string
    try {
      origin = new URL(options.pageUrl).origin
    } catch {
      return
    }
    const notify = () =>
      window.parent.postMessage(
        {
          type: 'ascs:resize',
          siteId: options.siteId,
          height: document.documentElement.scrollHeight,
        },
        origin,
      )
    const observer = new ResizeObserver(notify)
    observer.observe(document.body)
    notify()
    return () => observer.disconnect()
  }, [options.siteId, options.pageUrl])
  const list = useQuery({
    queryKey: queryKeys.commentList({
      siteId: options.siteId,
      pageUrl: options.pageUrl,
      pageKey: options.pageKey,
      sort,
      page,
    }),
    queryFn: ({ signal }) =>
      api<CommentList>(`comments?${queryString({ ...options, sort, page })}`, {
        signal,
      }),
    enabled: !!config.data,
  })
  const send = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ id: string; status: string }>('comments', {
        method: 'POST',
        body: input,
      }),
    onSuccess: async (result, variables) => {
      const submittedText = String(variables.body || '')
      const submittedReply = variables.parentId
        ? String(variables.parentId)
        : undefined
      if (
        textRef.current === submittedText &&
        (!submittedReply || replyRef.current?.id === submittedReply)
      ) {
        setText('')
        setReply(null)
        setPreview(false)
      }
      setNotice(
        result.status === 'approved'
          ? '评论已发布'
          : '评论已收到，审核通过后会显示',
      )
      setError('')
      if (result.status === 'approved' && sort !== 'newest') {
        try {
          const location = await api<CommentLocation>(
            `comments/locate?${queryString({ ...options, sort, commentId: result.id })}`,
          )
          setPage(location.path[0]?.page || 1)
          setExpandPath(location.path.map((item) => item.id))
        } catch {
          setPage(1)
        }
      } else setPage(1)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope.comments(options.siteId),
      })
      await config.refetch()
    },
    onError: (errorValue) => {
      setError(errorText(errorValue))
    },
  })
  if (config.isPending)
    return (
      <main className="widget" role="status">
        正在加载评论…
      </main>
    )
  if (config.error)
    return (
      <main className="widget">
        <QueryError error={config.error} retry={config.refetch} />
      </main>
    )
  const formDisabled = send.isPending || session.isPending
  return (
    <main
      className="widget"
      data-mode={mode}
      style={
        options.accent && /^#[0-9a-f]{6}$/i.test(options.accent)
          ? ({ '--accent': options.accent } as React.CSSProperties)
          : undefined
      }
    >
      <header className="widget-heading">
        <h1>
          评论 <span>{list.data?.total || 0}</span>
        </h1>
        {session.isPending ? (
          <span role="status" className="text-muted">
            正在检查登录状态…
          </span>
        ) : session.data ? (
          <div className="flex flex-1 justify-end gap-2 items-center min-w-0">
            <Avatar
              name={session.data.user.name}
              image={session.data.user.image}
            />
            <span
              className="truncate min-w-0 font-medium"
              title={session.data.user.name}
            >
              {session.data.user.name}
            </span>
            <LinkButton
              href="/profile"
              external
              shape="square"
              variant="ghost"
              aria-label="个人设置"
              title="个人设置"
              className="shrink-0"
            >
              <GearSixIcon size={17} />
            </LinkButton>
            <Button
              shape="square"
              variant="ghost"
              aria-label="退出登录"
              title="退出登录"
              className="shrink-0"
              onClick={async () => {
                const warning = await onSignOut()
                if (warning) setError(warning)
              }}
            >
              <SignOutIcon size={17} />
            </Button>
          </div>
        ) : (
          <Button icon={SignInIcon} onClick={onLogin}>
            登录
          </Button>
        )}
      </header>
      {!config.data.allowAnonymous && !session.data ? (
        <div className="empty-state">
          <ChatCircleIcon size={30} aria-hidden="true" />
          <div className="empty-copy">
            <p>此站点需要登录后发表评论。</p>
            <Button onClick={onLogin}>登录后评论</Button>
          </div>
        </div>
      ) : (
        <CommentComposer
          options={options}
          session={session}
          challenge={config.data.challenge}
          formDisabled={formDisabled}
          send={send}
          reply={reply}
          setReply={setReply}
          text={text}
          setText={setText}
          preview={preview}
          setPreview={setPreview}
          editorRef={editorRef}
          onSubmitStart={() => {
            setNotice('')
            setError('')
          }}
        />
      )}
      {(send.error || error || loginError) && (
        <p role="alert" className="error-box mt-3">
          {error || loginError || errorText(send.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="success-box mt-3">
          {notice}
        </p>
      )}
      <div className="widget-list-heading">
        <h2>讨论</h2>
        <label className="sr-only" htmlFor="comment-sort">
          排序方式
        </label>
        <select
          id="comment-sort"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as typeof sort)
            setPage(1)
          }}
        >
          <option value="newest">最新</option>
          <option value="oldest">最早</option>
          <option value="popular">最热</option>
        </select>
      </div>
      {list.isPending ? (
        <p role="status" className="py-6 text-muted">
          正在加载…
        </p>
      ) : list.error ? (
        <QueryError error={list.error} retry={list.refetch} />
      ) : !list.data.items.length ? (
        <p className="widget-empty">暂无评论</p>
      ) : (
        list.data.items.map((comment) => (
          <Thread
            key={comment.id}
            comment={comment}
            options={options}
            sort={sort}
            expandPath={expandPath}
            onReply={(target) => {
              setReply(target)
              setPreview(false)
              setNotice('')
              requestAnimationFrame(() => {
                focusContent(editorRef.current)
                editorRef.current?.focus()
              })
              document
                .querySelector('.comment-form')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        ))
      )}
      <Pagination
        page={page}
        setPage={(next) => {
          setPage(next)
          requestAnimationFrame(() => {
            document
              .querySelector('.widget-list-heading')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          })
        }}
        hasMore={!!list.data?.hasMore}
        loading={list.isFetching}
        totalPages={list.data?.totalPages}
      />
      <footer className="widget-footer">
        <a
          className="text-link"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/brand.svg" alt="" width="16" height="16" />
          ASCS
        </a>
      </footer>
    </main>
  )
}
