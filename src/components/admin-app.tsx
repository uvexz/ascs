import { useEffect, useState } from 'react'
import {
  Link,
  useBlocker,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  DropdownMenu,
  Input,
  Sidebar,
  useSidebar,
} from '@cloudflare/kumo'
import {
  ArrowRightIcon,
  CaretUpDownIcon,
  GlobeIcon,
  PlusIcon,
  SignOutIcon,
  WarningCircleIcon,
  ArrowClockwiseIcon,
  UserCircleIcon,
} from '@phosphor-icons/react'
import { api, ApiError, errorText, fieldError, queryString } from '../lib/api'
import { invalidateSiteCaches } from '../lib/cache'
import { authClient } from '../lib/auth-client'
import { AuthForm } from './auth-form'
import { Avatar } from './avatar'
import { AppDialog, ErrorBoundary, QueryError } from './ui'
import { InstanceAdmin, isSystemView, systemNavigation } from './instance-admin'
import { CommentManagement } from './admin/comment-management'
import { Statistics } from './admin/statistics'
import { Integration } from './admin/integration'
import { Settings } from './admin/settings'
import { Members } from './admin/members'
import { SiteSwitcher } from './admin/site-picker'
import { navigation } from './admin/shared'
import type { View } from './admin/shared'
import type { Dashboard, SiteDetail } from '../server/api.server'
import type { AdminSearch } from '../lib/validation'

function NavTrigger({ className }: { className?: string }) {
  const { open, isMobile } = useSidebar()
  return (
    <Sidebar.Trigger
      className={className}
      aria-label={isMobile ? '打开导航' : open ? '折叠导航栏' : '展开导航栏'}
    />
  )
}

export function AdminApp() {
  const queryClient = useQueryClient()
  const navigate = useNavigate({ from: '/' })
  const search = useSearch({ from: '/' })
  const [createOpen, setCreateOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const dashboard = useQuery({
    queryKey: ['dashboard', search.site],
    queryFn: ({ signal }) =>
      api<Dashboard>(`dashboard?${queryString({ site: search.site })}`, {
        signal,
      }),
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
      await queryClient.invalidateQueries({ queryKey: ['site-picker'] })
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
    void navigate({
      search: (previous) => ({
        ...previous,
        site,
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
  const roleLabel = dashboard.data.admin
    ? '实例管理员'
    : owner
      ? '站点所有者'
      : '站点成员'
  const pendingCount =
    detail.data?.stats.find((stat) => stat.status === 'pending')?.count ?? 0
  const signOut = async () => {
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error(result.error.message)
      queryClient.clear()
      window.location.assign('/')
    } catch (error) {
      setFeedback(errorText(error))
    }
  }
  return (
    <>
      <Sidebar.Provider defaultOpen className="h-dvh">
        <Sidebar>
          <Sidebar.Header className="group-data-[state=collapsed]/sidebar:justify-center h-[65px] px-3.5">
            <a href="/" className="brand px-3">
              <img src="/brand.svg" width="26" height="26" alt="" />
              <span className="truncate group-data-[state=collapsed]/sidebar:hidden">
                {instanceName}
              </span>
            </a>
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu>
                <SiteSwitcher
                  currentId={current?.id}
                  currentName={current?.name}
                  onSelect={selectSite}
                  canCreate={dashboard.data.canCreateSite}
                  ownedSites={
                    dashboard.data.admin ? undefined : dashboard.data.ownedSites
                  }
                  siteLimit={
                    dashboard.data.admin ? undefined : dashboard.data.siteLimit
                  }
                  onAdd={startCreate}
                />
              </Sidebar.Menu>
            </Sidebar.Group>
            <Sidebar.Group>
              <Sidebar.GroupLabel>站点管理</Sidebar.GroupLabel>
              <Sidebar.Menu>
                {navigation
                  .filter(
                    (item) =>
                      owner || !['settings', 'members'].includes(item.id),
                  )
                  .map((item) => (
                    <Sidebar.MenuButton
                      key={item.id}
                      icon={item.icon}
                      active={search.view === item.id}
                      tooltip={item.label}
                      onClick={() => setView(item.id)}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.id === 'comments' && pendingCount > 0 && (
                        <Sidebar.MenuBadge>{pendingCount}</Sidebar.MenuBadge>
                      )}
                    </Sidebar.MenuButton>
                  ))}
              </Sidebar.Menu>
            </Sidebar.Group>
            {dashboard.data.admin && (
              <Sidebar.Group>
                <Sidebar.GroupLabel>实例管理</Sidebar.GroupLabel>
                <Sidebar.Menu>
                  {systemNavigation.map((item) => (
                    <Sidebar.MenuButton
                      key={item.id}
                      icon={item.icon}
                      active={search.view === item.id}
                      tooltip={item.label}
                      onClick={() => setView(item.id)}
                    >
                      <span className="truncate">{item.label}</span>
                    </Sidebar.MenuButton>
                  ))}
                </Sidebar.Menu>
              </Sidebar.Group>
            )}
          </Sidebar.Content>
          <Sidebar.Footer className="h-16">
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <button type="button" className="user-menu-trigger">
                    <Avatar
                      name={dashboard.data.user.name}
                      image={dashboard.data.user.image}
                      size={28}
                    />
                    <span className="user-menu-copy min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
                      <span className="block truncate font-medium">
                        {dashboard.data.user.name}
                      </span>
                      <span className="block truncate text-muted">
                        {roleLabel}
                      </span>
                    </span>
                    <CaretUpDownIcon
                      size={14}
                      className="shrink-0 opacity-60 group-data-[state=collapsed]/sidebar:hidden"
                    />
                  </button>
                }
              />
              <DropdownMenu.Content side="top" align="start" sideOffset={8}>
                <DropdownMenu.Item
                  icon={UserCircleIcon}
                  onClick={() => void navigate({ to: '/profile' })}
                >
                  个人设置
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  icon={SignOutIcon}
                  variant="danger"
                  onClick={() => void signOut()}
                >
                  退出登录
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </Sidebar.Footer>
        </Sidebar>
        <div className="workspace">
          <header className="topbar">
            <div className="flex gap-2 min-w-0 items-center">
              <NavTrigger />
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
                      <p className="text-muted mt-1">
                        {instanceName} · 实例管理
                      </p>
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
                  <ErrorBoundary key={search.view}>
                    <InstanceAdmin
                      view={search.view}
                      actorId={dashboard.data.user.id}
                      onDirtyChange={setSettingsDirty}
                    />
                  </ErrorBoundary>
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
                  <Button
                    variant="primary"
                    icon={PlusIcon}
                    onClick={startCreate}
                  >
                    添加站点
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <h1>{currentView?.label}</h1>
                    <p className="text-muted mt-1 break-words">
                      {current.name}
                    </p>
                  </div>
                  <Button
                    shape="square"
                    aria-label="刷新数据"
                    title="刷新数据"
                    onClick={() => {
                      void invalidateSiteCaches(queryClient, current.id)
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
                  <ErrorBoundary key={`${current.id}:${search.view}`}>
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
                  </ErrorBoundary>
                )}
              </>
            )}
          </main>
          <footer className="workspace-footer">
            <span>ASCS</span>
            <span>A Simple Comment System</span>
            <nav className="footer-links" aria-label="法务信息">
              <Link to="/tos" className="text-link">
                服务条款
              </Link>
              <Link to="/privacy" className="text-link">
                隐私声明
              </Link>
            </nav>
          </footer>
        </div>
      </Sidebar.Provider>
      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="添加站点"
        description="添加博客站点后，需要完成 DNS 验证才能启用公开评论。"
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
    </>
  )
}
