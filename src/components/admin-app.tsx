import { useEffect, useRef, useState } from 'react'
import {
  Link,
  useBlocker,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import {
  ArrowRightIcon,
  ChatCircleIcon,
  CheckIcon,
  CopyIcon,
  GearSixIcon,
  GlobeIcon,
  PlusIcon,
  ShieldCheckIcon,
  SignOutIcon,
  TrashIcon,
  WarningCircleIcon,
  CodeIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowClockwiseIcon,
  UserCircleIcon,
} from '@phosphor-icons/react'
import { api, ApiError, errorText, fieldError, queryString } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { AuthForm } from './auth-form'
import { Avatar } from './avatar'
import { AppDialog, QueryError } from './ui'
import { Markdown } from './markdown'
import { Pagination } from './pagination'
import { InstanceAdmin, isSystemView, systemNavigation } from './instance-admin'
import type { AdminComments, Dashboard, SiteDetail } from '../server/api.server'
import type { AdminSearch, SiteSettings } from '../lib/validation'

type View = AdminSearch['view']
type Status = AdminSearch['status']
const statusLabels: Record<Status, string> = {
  pending: '待审核',
  approved: '已发布',
  spam: '垃圾评论',
  deleted: '已删除',
  all: '全部',
}
const navigation = [
  { id: 'comments', label: '评论', icon: ChatCircleIcon },
  { id: 'statistics', label: '统计', icon: ChartBarIcon },
  { id: 'integration', label: '集成', icon: CodeIcon },
  { id: 'settings', label: '站点设置', icon: GearSixIcon },
  { id: 'members', label: '成员与封禁', icon: UsersIcon },
] as const

export function AdminApp() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/' })
  const search = useSearch({ from: '/' })
  const [createOpen, setCreateOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const createTriggerRef = useRef<HTMLButtonElement>(null)
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => api<Dashboard>('dashboard', { signal }),
  })
  const current =
    dashboard.data?.sites.find((site) => site.id === search.site) ||
    dashboard.data?.sites[0]
  const owner = current?.role === 'owner'
  const detail = useQuery({
    queryKey: ['site', current?.id],
    queryFn: ({ signal }) =>
      api<SiteDetail>(`sites/${current!.id}`, { signal }),
    enabled: !!current && !isSystemView(search.view),
  })
  const create = useMutation({
    mutationFn: (input: { name: string; origin: string }) =>
      api<{ id: string }>('sites', { method: 'POST', body: input }),
    onSuccess: async (result) => {
      setCreateOpen(false)
      setFeedback('站点已添加，请完成域名验证。')
      setSettingsDirty(false)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      await navigate({
        search: (previous) => ({
          ...previous,
          site: result.id,
          view: 'integration',
          status: 'pending',
          page: 1,
        }),
      })
    },
  })
  const blocker = useBlocker({
    shouldBlockFn: () => settingsDirty,
    withResolver: true,
    enableBeforeUnload: true,
  })

  useEffect(() => {
    if (!dashboard.data) return
    if (isSystemView(search.view)) {
      if (!dashboard.data.admin)
        void navigate({
          search: (previous) => ({ ...previous, view: 'comments', page: 1 }),
        })
      return
    }
    if (!current) {
      if (search.site)
        void navigate({
          search: (previous) => ({
            ...previous,
            site: undefined,
            view: 'comments',
            page: 1,
          }),
        })
      return
    }
    const allowed = owner || !['settings', 'members'].includes(search.view)
    const patch: Partial<AdminSearch> = {}
    if (search.site !== current.id) patch.site = current.id
    if (!allowed) patch.view = 'comments'
    if (Object.keys(patch).length)
      void navigate({ search: (previous) => ({ ...previous, ...patch }) })
  }, [current, dashboard.data, navigate, owner, search.site, search.view])

  useEffect(() => {
    if (dashboard.data)
      document.title = `${dashboard.data.instance.name} · 评论管理`
  }, [dashboard.data])

  if (dashboard.isPending)
    return (
      <main className="loading-page" role="status">
        正在加载 ASCS…
      </main>
    )
  if (dashboard.error instanceof ApiError && dashboard.error.status === 401)
    return (
      <main className="auth-page">
        <AuthForm initialMode={search.auth || 'login'} />
      </main>
    )
  if (dashboard.error)
    return (
      <main className="auth-page">
        <QueryError error={dashboard.error} retry={dashboard.refetch} />
      </main>
    )
  const leaveSettings = () => {
    if (!settingsDirty || window.confirm('设置尚未保存，确定要离开吗？')) {
      setSettingsDirty(false)
      return true
    }
    return false
  }
  const setView = (view: View) => {
    if (!leaveSettings()) return
    setFeedback('')
    void navigate({ search: (previous) => ({ ...previous, view, page: 1 }) })
  }
  const selectSite = (site: string) => {
    if (!leaveSettings()) return
    setFeedback('')
    const nextSite = dashboard.data.sites.find((item) => item.id === site)
    if (!nextSite) return
    void navigate({
      search: (previous) => ({
        ...previous,
        site,
        view:
          nextSite.role === 'owner' ||
          !['settings', 'members'].includes(previous.view)
            ? previous.view
            : 'comments',
        status: 'pending',
        page: 1,
      }),
    })
  }
  const startCreate = () => {
    create.reset()
    setFeedback('')
    setCreateOpen(true)
  }
  const currentView = [...navigation, ...systemNavigation].find(
    (item) => item.id === search.view,
  )
  const systemView = isSystemView(search.view)
  const instanceName = dashboard.data.instance.name
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <img src="/brand.svg" width="30" height="30" alt="" />
          <span className="truncate">{instanceName}</span>
          <span className="brand-caption">评论管理</span>
        </a>
        <div className="site-picker">
          <label htmlFor="site-picker">当前站点</label>
          <select
            id="site-picker"
            value={current?.id || ''}
            onChange={(event) => selectSite(event.target.value)}
          >
            <option value="" disabled>
              暂无站点
            </option>
            {dashboard.data.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
        <nav aria-label="管理导航">
          {navigation
            .filter(
              (item) => owner || !['settings', 'members'].includes(item.id),
            )
            .map((item) => (
              <button
                type="button"
                key={item.id}
                aria-current={search.view === item.id ? 'page' : undefined}
                className={
                  search.view === item.id ? 'nav-item active' : 'nav-item'
                }
                onClick={() => setView(item.id)}
              >
                <item.icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === 'comments' &&
                  !!detail.data?.stats.find((stat) => stat.status === 'pending')
                    ?.count && (
                    <span className="nav-count">
                      {
                        detail.data.stats.find(
                          (stat) => stat.status === 'pending',
                        )?.count
                      }
                    </span>
                  )}
              </button>
            ))}
        </nav>
        {dashboard.data.admin && (
          <nav
            className="mt-5 pt-4 border-t border-kumo-line"
            aria-label="系统管理导航"
          >
            <p className="text-muted px-3 mb-2">实例管理</p>
            {systemNavigation.map((item) => (
              <button
                type="button"
                key={item.id}
                className={
                  search.view === item.id ? 'nav-item active' : 'nav-item'
                }
                aria-current={search.view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                <ShieldCheckIcon size={19} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
        {dashboard.data.canCreateSite && (
          <Button
            ref={createTriggerRef}
            className="mt-5"
            icon={PlusIcon}
            onClick={startCreate}
          >
            添加站点
          </Button>
        )}
        {dashboard.data.canCreateSite && !dashboard.data.admin && (
          <p className="text-muted mt-2">
            站点额度：{dashboard.data.ownedSites} / {dashboard.data.siteLimit}
          </p>
        )}
        <div className="sidebar-footer">
          <Link to="/profile" className="nav-item mb-3">
            <UserCircleIcon size={19} aria-hidden="true" />
            <span>个人设置</span>
          </Link>
          <div className="flex gap-2 items-center">
            <ShieldCheckIcon size={17} aria-hidden="true" />
            <span>
              {dashboard.data.admin
                ? '实例管理员'
                : owner
                  ? '站点所有者'
                  : '站点成员'}
            </span>
          </div>
          <div className="user-row">
            <Avatar
              name={dashboard.data.user.name}
              image={dashboard.data.user.image}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{dashboard.data.user.name}</p>
              <p className="truncate text-muted">{dashboard.data.user.email}</p>
            </div>
            <Button
              shape="square"
              variant="ghost"
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                try {
                  const result = await authClient.signOut()
                  if (result.error) throw new Error(result.error.message)
                  queryClient.clear()
                  window.location.assign('/')
                } catch (error) {
                  setFeedback(errorText(error))
                }
              }}
            >
              <SignOutIcon size={18} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="flex gap-2 min-w-0 items-center">
            <GlobeIcon size={17} aria-hidden="true" />
            <span className="truncate">
              {current && !systemView
                ? new URL(current.origin).hostname
                : instanceName}
            </span>
            <span className="text-muted" aria-hidden="true">
              /
            </span>
            <span>{currentView?.label}</span>
          </div>
          {!systemView && (
            <div className="flex gap-2 items-center">
              <span
                className={`status-dot ${current?.verifiedAt && current.enabled ? 'verified' : ''}`}
                aria-hidden="true"
              />
              <span className="text-muted">
                {current
                  ? !current.enabled
                    ? '站点已停用'
                    : current.verifiedAt
                      ? '站点已验证'
                      : '待验证'
                  : '尚未添加站点'}
              </span>
            </div>
          )}
        </header>
        <main className="main-content">
          {feedback && (
            <p role="status" className="success-box mb-4">
              {feedback}
            </p>
          )}
          {systemView ? (
            dashboard.data.admin ? (
              <>
                <div className="page-heading">
                  <div>
                    <h1>{currentView?.label}</h1>
                    <p className="text-muted mt-1">{instanceName} · 实例管理</p>
                  </div>
                  <Button
                    shape="square"
                    aria-label="刷新系统数据"
                    title="刷新系统数据"
                    disabled={settingsDirty}
                    onClick={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ['instance-admin'],
                      })
                    }}
                  >
                    <ArrowClockwiseIcon size={18} />
                  </Button>
                </div>
                <InstanceAdmin
                  key={search.view}
                  view={search.view}
                  actorId={dashboard.data.user.id}
                  onDirtyChange={setSettingsDirty}
                />
              </>
            ) : (
              <p role="alert" className="error-box">
                只有实例管理员可以访问系统管理。
              </p>
            )
          ) : !current ? (
            <div className="empty-state">
              <GlobeIcon size={40} aria-hidden="true" />
              <div className="empty-copy">
                <h1>暂无站点</h1>
                <p>
                  {dashboard.data.canCreateSite
                    ? '添加你的第一个博客站点'
                    : `当前站点额度为 ${dashboard.data.siteLimit}，请联系管理员调整额度或分配站点权限`}
                </p>
              </div>
              {dashboard.data.canCreateSite && (
                <Button variant="primary" icon={PlusIcon} onClick={startCreate}>
                  添加站点
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <h1>{currentView?.label}</h1>
                  <p className="text-muted mt-1 break-words">{current.name}</p>
                </div>
                <Button
                  shape="square"
                  aria-label="刷新数据"
                  title="刷新数据"
                  onClick={() => {
                    void queryClient.invalidateQueries({
                      queryKey: ['site', current.id],
                    })
                    void queryClient.invalidateQueries({
                      queryKey: ['admin-comments', current.id],
                    })
                  }}
                >
                  <ArrowClockwiseIcon size={18} />
                </Button>
              </div>
              {detail.isPending ? (
                <p role="status" className="py-10 text-muted">
                  正在加载站点数据…
                </p>
              ) : detail.error ? (
                <QueryError error={detail.error} retry={detail.refetch} />
              ) : (
                <>
                  {!current.enabled && (
                    <p role="alert" className="notice-band">
                      此站点已被实例管理员停用，公开评论服务不可用。
                    </p>
                  )}
                  {!current.verifiedAt && search.view !== 'integration' && (
                    <div className="notice-band">
                      <span className="h-lh flex items-center shrink-0">
                        <WarningCircleIcon size={19} aria-hidden="true" />
                      </span>
                      <span>站点尚未验证，公开评论接口暂不可用。</span>
                      <button
                        type="button"
                        onClick={() => setView('integration')}
                      >
                        验证站点
                        <ArrowRightIcon size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  {search.view === 'comments' && (
                    <CommentManagement
                      key={current.id}
                      detail={detail.data}
                      status={search.status}
                      page={search.page}
                      onStateChange={(patch) =>
                        void navigate({
                          search: (previous) => ({ ...previous, ...patch }),
                        })
                      }
                    />
                  )}
                  {search.view === 'statistics' && (
                    <Statistics detail={detail.data} />
                  )}
                  {search.view === 'integration' && (
                    <Integration key={current.id} detail={detail.data} />
                  )}
                  {search.view === 'settings' && owner && (
                    <Settings
                      key={current.id}
                      detail={detail.data}
                      onDirtyChange={setSettingsDirty}
                    />
                  )}
                  {search.view === 'members' && owner && (
                    <Members key={current.id} detail={detail.data} />
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer className="workspace-footer">
          <span>ASCS</span>
          <span>A Simple Comment System</span>
        </footer>
      </div>
      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="添加站点"
        description="添加博客站点后，需要完成 DNS 验证才能启用公开评论。"
        returnFocus={createTriggerRef}
        busy={create.isPending}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            create.mutate({
              name: String(form.get('name')),
              origin: String(form.get('origin')),
            })
          }}
        >
          <Input
            label="站点名称"
            name="name"
            required
            maxLength={80}
            error={fieldError(create.error, 'name')}
          />
          <Input
            label="站点地址"
            name="origin"
            type="url"
            placeholder="https://blog.example.com"
            required
            error={fieldError(create.error, 'origin')}
          />
          {create.error &&
            !fieldError(create.error, 'name') &&
            !fieldError(create.error, 'origin') && (
              <p role="alert" className="error-box">
                {errorText(create.error)}
              </p>
            )}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={PlusIcon}
              loading={create.isPending}
            >
              添加站点
            </Button>
          </div>
        </form>
      </AppDialog>
      {blocker.status === 'blocked' && (
        <AppDialog
          open
          title="放弃未保存的设置？"
          description="当前表单有未保存的修改。离开后这些修改会丢失。"
          alert
          onOpenChange={(open) => {
            if (!open) blocker.reset()
          }}
        >
          <div className="flex justify-end gap-2">
            <Button onClick={() => blocker.reset()}>继续编辑</Button>
            <Button variant="destructive" onClick={() => blocker.proceed()}>
              放弃修改
            </Button>
          </div>
        </AppDialog>
      )}
    </div>
  )
}

function StatsStrip({ detail }: { detail: SiteDetail }) {
  const total = detail.stats.reduce(
    (sum, stat) => sum + (stat.status !== 'deleted' ? stat.count : 0),
    0,
  )
  return (
    <div className="stats-strip">
      {[
        { label: '评论总数', value: total, className: '' },
        {
          label: '待审核',
          value:
            detail.stats.find((stat) => stat.status === 'pending')?.count || 0,
          className: 'amber',
        },
        {
          label: '已发布',
          value:
            detail.stats.find((stat) => stat.status === 'approved')?.count || 0,
          className: 'green',
        },
        {
          label: '垃圾评论',
          value:
            detail.stats.find((stat) => stat.status === 'spam')?.count || 0,
          className: 'red',
        },
      ].map((stat) => (
        <div key={stat.label}>
          <span className="text-muted">{stat.label}</span>
          <strong className={stat.className}>
            {stat.value.toLocaleString()}
          </strong>
        </div>
      ))}
    </div>
  )
}

function CommentManagement({
  detail,
  status,
  page,
  onStateChange,
}: {
  detail: SiteDetail
  status: Status
  page: number
  onStateChange: (patch: Partial<AdminSearch>) => void
}) {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [banTarget, setBanTarget] = useState<
    AdminComments['items'][number] | null
  >(null)
  const [notice, setNotice] = useState('')
  const list = useQuery({
    queryKey: ['admin-comments', detail.site.id, status, page],
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
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['admin-comments', detail.site.id],
      }),
      queryClient.invalidateQueries({ queryKey: ['site', detail.site.id] }),
    ])
  }
  const moderate = useMutation({
    mutationFn: (input: {
      commentId: string
      status: 'approved' | 'spam' | 'deleted'
    }) =>
      api(`sites/${detail.site.id}/comments`, { method: 'POST', body: input }),
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
        <div className="comment-list" tabIndex={-1} aria-label="评论列表">
          {list.data.items.map((comment) => (
            <article key={comment.id} className="admin-comment">
              <Avatar name={comment.author} image={comment.image} />
              <div className="min-w-0 flex-1">
                <div className="comment-meta">
                  <strong className="break-words">{comment.author}</strong>
                  <span className={`badge ${comment.status}`}>
                    {statusLabels[comment.status]}
                  </span>
                  <time>
                    {new Date(comment.createdAt).toLocaleString('zh-CN')}
                  </time>
                </div>
                <a
                  className="article-link"
                  href={comment.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {new URL(comment.pageUrl).pathname || '/'}
                </a>
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
      <AppDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open && !moderate.isPending) setDeleteId(null)
        }}
        title="删除评论？"
        description="内容和身份信息将永久清除，嵌套回复会保留。"
        alert
        busy={moderate.isPending}
      >
        <div>
          {moderate.error && (
            <p role="alert" className="error-box mb-4">
              {errorText(moderate.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setDeleteId(null)}
              disabled={moderate.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              icon={TrashIcon}
              loading={moderate.isPending}
              onClick={() =>
                deleteId &&
                moderate.mutate({ commentId: deleteId, status: 'deleted' })
              }
            >
              删除
            </Button>
          </div>
        </div>
      </AppDialog>
      <AppDialog
        open={!!banTarget}
        onOpenChange={(open) => {
          if (!open && !ban.isPending) setBanTarget(null)
        }}
        title="封禁评论者"
        description={
          banTarget
            ? `当前评论者：${banTarget.author}。仅影响当前站点，不会自动删除历史评论。`
            : ''
        }
        busy={ban.isPending}
      >
        <div>
          {ban.error && (
            <p role="alert" className="error-box mb-4">
              {errorText(ban.error)}
            </p>
          )}
          <div className="grid gap-3">
            <Button
              disabled={ban.isPending || !banTarget?.userId}
              onClick={() =>
                banTarget &&
                ban.mutate({ commentId: banTarget.id, kind: 'user' })
              }
            >
              封禁账号
            </Button>
            <Button
              disabled={ban.isPending || !banTarget?.hasEmail}
              onClick={() =>
                banTarget &&
                ban.mutate({ commentId: banTarget.id, kind: 'email' })
              }
            >
              封禁邮箱
            </Button>
            <Button
              disabled={ban.isPending || !detail.canBanIp || !banTarget?.hasIp}
              onClick={() =>
                banTarget && ban.mutate({ commentId: banTarget.id, kind: 'ip' })
              }
            >
              封禁 IP
            </Button>
            {!detail.canBanIp && (
              <p className="text-muted">
                当前服务未配置可信 IP 来源，无法安全区分不同评论者的 IP。
              </p>
            )}
            <Button
              variant="ghost"
              onClick={() => setBanTarget(null)}
              disabled={ban.isPending}
            >
              取消
            </Button>
          </div>
        </div>
      </AppDialog>
    </>
  )
}

function Statistics({ detail }: { detail: SiteDetail }) {
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) =>
    new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 6 + index,
      ),
    )
      .toISOString()
      .slice(0, 10),
  )
  const counts = days.map(
    (day) => detail.daily.find((item) => item.day === day)?.count || 0,
  )
  const max = Math.max(1, ...counts)
  return (
    <>
      <StatsStrip detail={detail} />
      <section className="settings-section">
        <h2>最近 7 天</h2>
        <div className="bar-chart" aria-label="最近七天评论数">
          {days.map((day, index) => {
            const count = counts[index]
            return (
              <div
                key={day}
                className="chart-column"
                aria-label={`${day}，${count} 条评论`}
              >
                <span>{count}</span>
                <div className="bar-track">
                  <div
                    style={{ height: count ? `${(count / max) * 100}%` : 0 }}
                  />
                </div>
                <time>{day.slice(5)}</time>
              </div>
            )
          })}
        </div>
        <p className="text-muted">UTC · 不含已删除评论</p>
      </section>
    </>
  )
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )
  return (
    <div>
      <div className="copy-block">
        <pre>{text}</pre>
        <Button
          shape="square"
          aria-label={copied ? '已复制' : '复制'}
          title={copied ? '已复制' : '复制'}
          onClick={async () => {
            setError('')
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              timeoutRef.current = setTimeout(() => setCopied(false), 1800)
            } catch {
              setCopied(false)
              setError('浏览器不允许访问剪贴板，请手动选择代码复制。')
            }
          }}
        >
          {copied ? <CheckIcon size={17} /> : <CopyIcon size={17} />}
        </Button>
      </div>
      {copied && (
        <p role="status" className="sr-only">
          已复制到剪贴板
        </p>
      )}
      {error && (
        <p role="alert" className="error-box mt-2">
          {error}
        </p>
      )}
    </div>
  )
}

function Integration({ detail }: { detail: SiteDetail }) {
  const queryClient = useQueryClient()
  const verify = useMutation({
    mutationFn: () =>
      api(`sites/${detail.site.id}/verify`, { method: 'POST', body: {} }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['site', detail.site.id],
      })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const [origin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin,
  )
  const hostname = new URL(detail.site.origin).hostname
  return (
    <>
      <section className="settings-section">
        <div className="section-heading">
          <h2>域名验证</h2>
          <span
            className={`badge ${detail.site.verifiedAt ? 'approved' : 'pending'}`}
          >
            {detail.site.verifiedAt ? '已验证' : '待验证'}
          </span>
        </div>
        <p className="section-description">
          在 DNS 服务商添加 TXT 记录后，等待记录生效，再点击“检查验证”。
        </p>
        <dl className="definition-list">
          <div>
            <dt>站点地址</dt>
            <dd>{detail.site.origin}</dd>
          </div>
          <div>
            <dt>TXT 主机记录</dt>
            <dd>
              <code>_ascs.{hostname}</code>
            </dd>
          </div>
          <div>
            <dt>TXT 记录值</dt>
            <dd>
              <CopyBlock
                text={`ascs-verification=${detail.site.verificationToken}`}
              />
            </dd>
          </div>
        </dl>
        <Button
          icon={ShieldCheckIcon}
          variant="primary"
          loading={verify.isPending}
          onClick={() => verify.mutate()}
        >
          检查验证
        </Button>
        {verify.error && (
          <p role="alert" className="error-box mt-4">
            {errorText(verify.error)}
          </p>
        )}
        {verify.isSuccess && (
          <p role="status" className="success-box mt-4">
            站点验证通过
          </p>
        )}
      </section>
      <section className="settings-section">
        <h2>嵌入代码</h2>
        <p className="section-description">
          默认使用站点设置中的主题。若要固定主题，可在复制后手动加入{' '}
          <code className="inline-code">data-theme</code> 属性。
        </p>
        <CopyBlock
          text={`<div id="ascs-comments"></div>\n<script src="${origin}/embed.js"\n  data-site="${detail.site.id}"\n  data-target="ascs-comments"\n  defer></script>`}
        />
      </section>
      <section className="settings-section">
        <h2>站点标识</h2>
        <CopyBlock text={detail.site.id} />
      </section>
    </>
  )
}

function Settings({
  detail,
  onDirtyChange,
}: {
  detail: SiteDetail
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SiteSettings>(() => ({
    name: detail.site.name,
    allowAnonymous: detail.site.allowAnonymous,
    moderation: detail.site.moderation,
    theme: detail.site.theme,
    notificationEmail: detail.site.notificationEmail || '',
    blockedWords: detail.site.blockedWords,
  }))
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!dirty)
      setDraft({
        name: detail.site.name,
        allowAnonymous: detail.site.allowAnonymous,
        moderation: detail.site.moderation,
        theme: detail.site.theme,
        notificationEmail: detail.site.notificationEmail || '',
        blockedWords: detail.site.blockedWords,
      })
  }, [detail, dirty])
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  const update = <TKey extends keyof SiteSettings>(
    key: TKey,
    value: SiteSettings[TKey],
  ) => {
    setDirty(true)
    setNotice('')
    setDraft((previous) => ({ ...previous, [key]: value }))
  }
  const save = useMutation({
    mutationFn: (input: SiteSettings) =>
      api(`sites/${detail.site.id}`, { method: 'PATCH', body: input }),
    onSuccess: async () => {
      setDirty(false)
      setNotice('设置已保存。')
      await queryClient.invalidateQueries({
        queryKey: ['site', detail.site.id],
      })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate(draft)
      }}
    >
      <section className="settings-section">
        <h2>基本设置</h2>
        <div className="form-width grid gap-5">
          <Input
            label="站点名称"
            name="name"
            value={draft.name}
            onChange={(event) => update('name', event.currentTarget.value)}
            required
            maxLength={80}
            error={fieldError(save.error, 'name')}
          />
          <div>
            <label className="field-label" htmlFor="theme">
              主题
            </label>
            <select
              id="theme"
              name="theme"
              value={draft.theme}
              onChange={(event) =>
                update('theme', event.target.value as SiteSettings['theme'])
              }
            >
              <option value="auto">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>评论与审核</h2>
        <div className="form-width grid gap-5">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="allowAnonymous"
              checked={draft.allowAnonymous}
              onChange={(event) =>
                update('allowAnonymous', event.target.checked)
              }
            />
            允许匿名评论
          </label>
          <div>
            <label className="field-label" htmlFor="moderation">
              审核方式
            </label>
            <select
              name="moderation"
              id="moderation"
              value={draft.moderation}
              onChange={(event) =>
                update(
                  'moderation',
                  event.target.value as SiteSettings['moderation'],
                )
              }
            >
              <option value="all">所有评论需审核</option>
              <option value="anonymous">仅匿名评论需审核</option>
              <option value="none">自动发布</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="blockedWords">
              屏蔽词（每行一个）
            </label>
            <textarea
              name="blockedWords"
              id="blockedWords"
              rows={5}
              maxLength={2000}
              value={draft.blockedWords}
              onChange={(event) =>
                update('blockedWords', event.currentTarget.value)
              }
            />
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>邮件通知</h2>
        <div className="form-width">
          <Input
            label="通知邮箱"
            description="新评论通知会发送到此邮箱，评论者邮箱不会公开。"
            name="notificationEmail"
            type="email"
            maxLength={254}
            value={draft.notificationEmail || ''}
            onChange={(event) =>
              update('notificationEmail', event.currentTarget.value)
            }
            error={fieldError(save.error, 'notificationEmail')}
          />
        </div>
      </section>
      {save.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(save.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      <Button
        variant="primary"
        icon={CheckIcon}
        loading={save.isPending}
        type="submit"
      >
        保存设置
      </Button>
    </form>
  )
}

function Members({ detail }: { detail: SiteDetail }) {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState('')
  const [memberRole, setMemberRole] = useState<'owner' | 'moderator'>(
    'moderator',
  )
  const change = useMutation({
    mutationFn: (input: {
      action: 'members' | 'bans'
      method: 'POST' | 'DELETE'
      body: unknown
    }) =>
      api(`sites/${detail.site.id}/${input.action}`, {
        method: input.method,
        body: input.body,
      }),
    onSuccess: async () => {
      setNotice('操作已完成。')
      await queryClient.invalidateQueries({
        queryKey: ['site', detail.site.id],
      })
    },
  })
  return (
    <>
      {change.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(change.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      <section className="settings-section">
        <h2>站点成员</h2>
        <div className="data-list">
          {detail.members.map((member) => (
            <div key={member.id}>
              <div className="min-w-0 break-words">
                <p>{member.name}</p>
                <p className="text-muted break-all">{member.email}</p>
              </div>
              <span className="text-muted">
                {member.role === 'owner' ? '所有者' : '审核员'}
              </span>
              {member.role === 'moderator' && (
                <Button
                  shape="square"
                  title="移除成员"
                  aria-label={`移除成员 ${member.name}`}
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({
                      action: 'members',
                      method: 'DELETE',
                      body: { userId: member.id },
                    })
                  }
                >
                  <TrashIcon size={17} />
                </Button>
              )}
            </div>
          ))}
        </div>
        <form
          className="member-form"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            change.mutate({
              action: 'members',
              method: 'POST',
              body: {
                email: String(form.get('email')),
                role: String(form.get('role')),
                confirmOwner: form.get('confirmOwner') === 'on',
              },
            })
            event.currentTarget.reset()
            setMemberRole('moderator')
          }}
        >
          <Input label="成员邮箱" name="email" type="email" required />
          <div>
            <label className="field-label" htmlFor="member-role">
              角色
            </label>
            <select
              id="member-role"
              name="role"
              value={memberRole}
              onChange={(event) =>
                setMemberRole(event.target.value as typeof memberRole)
              }
            >
              <option value="moderator">审核员</option>
              <option value="owner">所有者</option>
            </select>
          </div>
          {memberRole === 'owner' && (
            <label className="checkbox-label member-owner-warning">
              <input type="checkbox" name="confirmOwner" required />
              我确认授予所有者权限，并知悉当前后台无法移除所有者。
            </label>
          )}
          <Button type="submit" icon={PlusIcon} loading={change.isPending}>
            添加成员
          </Button>
        </form>
      </section>
      <section className="settings-section">
        <h2>封禁记录</h2>
        {detail.bans.length ? (
          <div className="data-list">
            {detail.bans.map((ban) => (
              <div key={ban.id}>
                <div className="min-w-0">
                  <span>
                    {ban.kind === 'user'
                      ? '账号封禁'
                      : ban.kind === 'email'
                        ? '邮箱封禁'
                        : 'IP 封禁'}
                  </span>
                  {ban.target && (
                    <p className="text-muted break-words">目标：{ban.target}</p>
                  )}
                </div>
                <time className="text-muted">
                  {new Date(ban.createdAt).toLocaleDateString('zh-CN')}
                </time>
                <Button
                  variant="ghost"
                  disabled={change.isPending}
                  onClick={() =>
                    change.mutate({
                      action: 'bans',
                      method: 'DELETE',
                      body: { banId: ban.id },
                    })
                  }
                >
                  解除封禁
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">暂无封禁记录</p>
        )}
      </section>
    </>
  )
}
