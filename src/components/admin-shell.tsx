import { createContext, useContext, useEffect, useState } from 'react'
import {
  Link,
  Outlet,
  useBlocker,
  useNavigate,
  useParams,
  useRouteContext,
  useRouterState,
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
  CaretUpDownIcon,
  GlobeIcon,
  PlusIcon,
  SignOutIcon,
  UserCircleIcon,
} from '@phosphor-icons/react'
import { api, ApiError, errorText, fieldError } from '../lib/api'
import { resetAuthCaches } from '../lib/cache'
import { dashboardQuery, siteDetailQuery } from '../lib/queries'
import { queryKeys } from '../lib/query-keys'
import { authClient } from '../lib/auth-client'
import { AuthForm } from './auth-form'
import { Avatar } from './avatar'
import { AppDialog, ErrorBoundary, QueryError } from './ui'
import { navigation, systemNavigation, viewLabel } from './admin/shared'
import { SiteSwitcher } from './admin/site-picker'

const siteTargets = {
  comments: '/admin/site/$siteId/comments',
  statistics: '/admin/site/$siteId/statistics',
  integration: '/admin/site/$siteId/integration',
  settings: '/admin/site/$siteId/settings',
  members: '/admin/site/$siteId/members',
} as const
const systemTargets = {
  overview: '/admin/instance/overview',
  users: '/admin/instance/users',
  sites: '/admin/instance/sites',
  settings: '/admin/instance/settings',
  mail: '/admin/instance/mail',
  audit: '/admin/instance/audit',
} as const

export const AdminShellContext = createContext<{
  setSettingsDirty: (dirty: boolean) => void
  setFeedback: (message: string) => void
  openCreate: () => void
}>({
  setSettingsDirty: () => {},
  setFeedback: () => {},
  openCreate: () => {},
})

export function useAdminShell() {
  return useContext(AdminShellContext)
}

function NavTrigger({ className }: { className?: string }) {
  const { open, isMobile } = useSidebar()
  return (
    <Sidebar.Trigger
      className={className}
      aria-label={isMobile ? '打开导航' : open ? '折叠导航栏' : '展开导航栏'}
    />
  )
}

export function AdminShell() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin' })
  const { authenticated } = useRouteContext({ from: '/admin' })
  const params = useParams({ strict: false })
  const activeSiteId = 'siteId' in params ? params.siteId : undefined
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [settingsDirty, setSettingsDirty] = useState(false)
  const systemView = pathname.startsWith('/admin/instance')
  const lastSegment = pathname.split('/').filter(Boolean).at(-1)
  const siteView = pathname.startsWith('/admin/site/')
    ? (lastSegment as keyof typeof siteTargets | undefined)
    : undefined
  const dashboard = useQuery({
    ...dashboardQuery(activeSiteId),
    enabled: authenticated,
  })
  const current =
    dashboard.data?.sites.find((site) => site.id === activeSiteId) ||
    dashboard.data?.sites[0]
  const owner = current?.role === 'owner'
  const detail = useQuery({
    ...siteDetailQuery(current?.id ?? ''),
    enabled: !!current && !systemView,
  })
  const pendingCount =
    detail.data?.stats.find((stat) => stat.status === 'pending')?.count ?? 0
  const create = useMutation({
    mutationFn: (input: { name: string; origin: string }) =>
      api<{ id: string }>('sites', { method: 'POST', body: input }),
    onSuccess: async (result) => {
      setCreateOpen(false)
      setFeedback('站点已添加，请完成域名验证。')
      setSettingsDirty(false)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope.dashboard,
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope.sitePicker,
      })
      await navigate({
        to: '/admin/site/$siteId/integration',
        params: { siteId: result.id },
      })
    },
  })
  const blocker = useBlocker({
    shouldBlockFn: () => settingsDirty,
    withResolver: true,
    enableBeforeUnload: () => settingsDirty,
  })

  useEffect(() => {
    setFeedback('')
  }, [pathname])

  useEffect(() => {
    if (dashboard.data)
      document.title = `${dashboard.data.instance.name} · 评论管理`
  }, [dashboard.data])

  if (!authenticated)
    return (
      <main className="auth-page">
        <AuthForm initialMode={search.auth || 'login'} />
      </main>
    )
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
  const openCreate = () => {
    create.reset()
    setFeedback('')
    setCreateOpen(true)
  }
  const selectSite = (siteId: string) => {
    const target = siteView && siteView in siteTargets ? siteView : 'comments'
    setFeedback('')
    void navigate({ to: siteTargets[target], params: { siteId } })
  }
  const instanceName = dashboard.data.instance.name
  const roleLabel = dashboard.data.admin
    ? '实例管理员'
    : owner
      ? '站点所有者'
      : '站点成员'
  const signOut = async () => {
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error(result.error.message)
      resetAuthCaches(queryClient)
      window.location.assign('/')
    } catch (error) {
      setFeedback(errorText(error))
    }
  }
  return (
    <AdminShellContext.Provider
      value={{ setSettingsDirty, setFeedback, openCreate }}
    >
      <Sidebar.Provider defaultOpen className="h-dvh">
        <Sidebar>
          <Sidebar.Header className="group-data-[state=collapsed]/sidebar:justify-center h-[65px] px-3.5">
            <Link to="/admin" className="brand px-3">
              <img src="/brand.svg" width="26" height="26" alt="" />
              <span className="truncate group-data-[state=collapsed]/sidebar:hidden">
                {instanceName}
              </span>
            </Link>
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
                  onAdd={openCreate}
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
                      active={!systemView && siteView === item.id}
                      tooltip={item.label}
                      disabled={!current}
                      onClick={() =>
                        current &&
                        void navigate({
                          to: siteTargets[item.id],
                          params: { siteId: current.id },
                        })
                      }
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
                      active={systemView && lastSegment === item.id}
                      tooltip={item.label}
                      onClick={() =>
                        void navigate({ to: systemTargets[item.id] })
                      }
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
              <span>{viewLabel(pathname)}</span>
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
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
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
    </AdminShellContext.Provider>
  )
}
