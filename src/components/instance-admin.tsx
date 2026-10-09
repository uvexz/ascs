import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { api, errorText, queryString } from '../lib/api'
import { AppDialog, QueryError } from './ui'
import { Pagination } from './pagination'
import type { AdminSearch } from '../lib/validation'
import type {
  SafeSystemSettings,
  UserCreate,
  UserUpdate,
} from '../lib/system-settings'
import type {
  InstanceAudit,
  InstanceMail,
  InstanceOverview,
  InstanceSites,
  InstanceUsers,
} from '../server/admin.server'

export const systemNavigation = [
  { id: 'system-overview', label: '系统概览' },
  { id: 'users', label: '用户管理' },
  { id: 'all-sites', label: '全部站点' },
  { id: 'system-settings', label: '系统设置' },
  { id: 'mail', label: '邮件队列' },
  { id: 'audit', label: '操作日志' },
] as const
export function isSystemView(view: string) {
  return systemNavigation.some((item) => item.id === view)
}

export function InstanceAdmin({
  view,
  actorId,
  onDirtyChange,
}: {
  view: AdminSearch['view']
  actorId: string
  onDirtyChange: (dirty: boolean) => void
}) {
  if (view === 'system-overview') return <Overview />
  if (view === 'system-settings')
    return <SystemSettings onDirtyChange={onDirtyChange} />
  if (view === 'users') return <Users actorId={actorId} />
  if (view === 'all-sites') return <Sites />
  if (view === 'mail') return <Mail />
  return <Audit />
}
function Overview() {
  const query = useQuery({
    queryKey: ['instance-admin', 'overview'],
    queryFn: ({ signal }) =>
      api<InstanceOverview>('admin/overview', { signal }),
  })
  if (query.isPending) return <p role="status">正在加载系统统计…</p>
  if (query.error)
    return <QueryError error={query.error} retry={query.refetch} />
  const value = query.data
  return (
    <>
      <div className="stats-strip">
        {[
          ['用户', value.users.total],
          ['站点', value.sites.total],
          [
            '待审核评论',
            value.comments.find((item) => item.status === 'pending')?.count ||
              0,
          ],
          ['发送失败邮件', value.mail.failed || 0],
        ].map(([label, count]) => (
          <div key={label}>
            <span className="text-muted">{label}</span>
            <strong>{Number(count).toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <section className="settings-section">
        <h2>运行概况</h2>
        <dl className="definition-list">
          <div>
            <dt>停用账号</dt>
            <dd>{value.users.disabled || 0}</dd>
          </div>
          <div>
            <dt>已验证站点</dt>
            <dd>{value.sites.verified || 0}</dd>
          </div>
          <div>
            <dt>停用站点</dt>
            <dd>{value.sites.disabled || 0}</dd>
          </div>
          <div>
            <dt>等待发送邮件</dt>
            <dd>{value.mail.pending || 0}</dd>
          </div>
          <div>
            <dt>已发送邮件</dt>
            <dd>{value.mail.sent || 0}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}
function Filters({
  q,
  setQ,
  status,
  setStatus,
  options,
  search = true,
}: {
  q: string
  setQ: (value: string) => void
  status: string
  setStatus: (value: string) => void
  options: [string, string][]
  search?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {search && (
        <Input
          label="搜索"
          value={q}
          maxLength={100}
          placeholder="名称或邮箱 / 地址"
          onChange={(event) => setQ(event.currentTarget.value)}
        />
      )}
      <div className="w-40">
        <label className="field-label" htmlFor="instance-filter">
          状态
        </label>
        <select
          id="instance-filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
function useList<T>(resource: string) {
  const [q, setSearch] = useState('')
  const [status, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['instance-admin', resource, q, status, page],
    queryFn: ({ signal }) =>
      api<T>(`admin/${resource}?${queryString({ q, status, page })}`, {
        signal,
      }),
  })
  return {
    query,
    q,
    status,
    page,
    setPage,
    setQ: (value: string) => {
      setSearch(value)
      setPage(1)
    },
    setStatus: (value: string) => {
      setFilter(value)
      setPage(1)
    },
  }
}
function ListPagination({
  list,
}: {
  list: {
    page: number
    setPage: (value: number) => void
    query: {
      isFetching: boolean
      data?: { page: number; hasMore: boolean; totalPages: number }
    }
  }
}) {
  useEffect(() => {
    if (list.query.data && list.query.data.page !== list.page)
      list.setPage(list.query.data.page)
  }, [list.query.data, list.page, list.setPage])
  return (
    <Pagination
      page={list.query.data?.page || list.page}
      setPage={list.setPage}
      hasMore={!!list.query.data?.hasMore}
      totalPages={list.query.data?.totalPages}
      loading={list.query.isFetching}
    />
  )
}
function useAdminRefresh() {
  const client = useQueryClient()
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['instance-admin'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
      client.invalidateQueries({ queryKey: ['site'] }),
    ])
  }
}
function Users({ actorId }: { actorId: string }) {
  const list = useList<InstanceUsers>('users')
  const refresh = useAdminRefresh()
  const [selected, setSelected] = useState<
    InstanceUsers['items'][number] | null
  >(null)
  const [revoke, setRevoke] = useState<InstanceUsers['items'][number] | null>(
    null,
  )
  const [notice, setNotice] = useState('')
  const change = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdate }) =>
      api(`admin/users/${id}`, { method: 'PATCH', body: input }),
    onSuccess: async () => {
      setSelected(null)
      setNotice('用户已更新。')
      await refresh()
    },
  })
  const sessions = useMutation({
    mutationFn: (id: string) =>
      api(`admin/users/${id}/revoke-sessions`, { method: 'POST', body: {} }),
    onSuccess: async (_, id) => {
      setRevoke(null)
      if (id === actorId) {
        window.location.assign('/')
        return
      }
      setNotice('该用户的所有登录已撤销。')
      await refresh()
    },
  })
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    InstanceUsers['items'][number] | null
  >(null)
  const create = useMutation({
    mutationFn: (input: UserCreate) =>
      api('admin/users', { method: 'POST', body: input }),
    onSuccess: async () => {
      setCreating(false)
      setNotice('用户已创建。')
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`admin/users/${id}`, { method: 'DELETE', body: {} }),
    onSuccess: async () => {
      setDeleteTarget(null)
      setNotice('用户已删除。')
      await refresh()
    },
  })
  return (
    <>
      <Button
        className="mb-4"
        onClick={() => {
          create.reset()
          setCreating(true)
        }}
      >
        创建用户
      </Button>
      <p className="text-muted mb-5">
        管理员拥有全局权限。额度按用户拥有的站点计数，降低额度不会删除已有站点。
      </p>
      <Filters
        {...list}
        options={[
          ['all', '全部'],
          ['active', '正常'],
          ['disabled', '已停用'],
          ['admin', '管理员'],
        ]}
      />
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      {list.query.isPending ? (
        <p role="status">正在加载用户…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <>
          <p className="text-muted mb-3">共 {list.query.data.total} 位用户</p>
          <div className="data-list">
            {list.query.data.items.map((person) => (
              <div key={person.id} className="flex-wrap">
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">
                    {person.name} {person.id === actorId && '（你）'}
                  </p>
                  <p className="text-muted break-all">{person.email}</p>
                  <p className="text-muted">
                    注册于{' '}
                    {new Date(person.createdAt).toLocaleDateString('zh-CN')} ·
                    邮箱{person.emailVerified ? '已验证' : '未验证'}
                  </p>
                </div>
                <span
                  className={`badge ${person.disabled ? 'spam' : 'approved'}`}
                >
                  {person.disabled ? '停用' : person.admin ? '管理员' : '用户'}
                </span>
                <span>
                  站点 {person.ownedSites} /{' '}
                  {person.admin ? '不限' : person.siteLimit}
                </span>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      change.reset()
                      setSelected(person)
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    onClick={() => {
                      sessions.reset()
                      setRevoke(person)
                    }}
                  >
                    撤销登录
                  </Button>
                  <Button
                    disabled={person.id === actorId}
                    onClick={() => {
                      remove.reset()
                      setDeleteTarget(person)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!list.query.data.items.length && (
            <p className="empty-state">没有匹配的用户</p>
          )}
        </>
      )}
      <ListPagination list={list} />
      <AppDialog
        open={creating}
        onOpenChange={setCreating}
        title="创建用户"
        description="注册关闭时管理员仍可创建账号。请通过可信渠道告知用户初始密码。"
        busy={create.isPending}
      >
        <form
          key={String(creating)}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            create.mutate({
              name: String(form.get('name')),
              email: String(form.get('email')),
              password: String(form.get('password')),
              siteLimit: Number(form.get('siteLimit')),
              admin: form.get('admin') === 'on',
              disabled: false,
            })
          }}
        >
          <fieldset disabled={create.isPending} className="grid gap-4">
            <Input label="昵称" name="name" required maxLength={60} />
            <Input
              label="邮箱"
              name="email"
              type="email"
              required
              maxLength={254}
            />
            <Input
              label="初始密码"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
            <Input
              label="站点额度"
              name="siteLimit"
              type="number"
              defaultValue={0}
              required
              min={0}
              max={10000}
            />
            <label className="checkbox-label">
              <input type="checkbox" name="admin" />
              实例管理员
            </label>
          </fieldset>
          {create.error && (
            <p role="alert" className="error-box">
              {errorText(create.error)}
            </p>
          )}
          <Button type="submit" variant="primary" loading={create.isPending}>
            创建用户
          </Button>
        </form>
      </AppDialog>
      <AppDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="删除用户？"
        description={`将永久删除 ${deleteTarget?.email || ''} 的账号、登录和成员关系。历史评论保留并匿名化；拥有站点的用户必须先转移站点。`}
        busy={remove.isPending}
        alert
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            if (deleteTarget && form.get('confirmation') === deleteTarget.email)
              remove.mutate(deleteTarget.id)
          }}
          className="grid gap-4"
        >
          <Input
            key={deleteTarget?.id}
            label="输入用户邮箱确认删除"
            name="confirmation"
            type="email"
            required
            autoComplete="off"
            onChange={(event) =>
              event.currentTarget.setCustomValidity(
                event.currentTarget.value === deleteTarget?.email
                  ? ''
                  : '请输入待删除用户的邮箱',
              )
            }
          />
          {remove.error && (
            <p role="alert" className="error-box">
              {errorText(remove.error)}
            </p>
          )}
          <Button
            type="submit"
            variant="destructive"
            loading={remove.isPending}
          >
            永久删除用户
          </Button>
        </form>
      </AppDialog>
      <AppDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title="编辑用户"
        description={selected?.email || ''}
        busy={change.isPending}
      >
        <form
          key={selected?.id}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!selected) return
            const form = new FormData(event.currentTarget)
            change.mutate({
              id: selected.id,
              input: {
                name: String(form.get('name')),
                siteLimit: Number(form.get('siteLimit')),
                disabled: form.get('disabled') === 'on',
                admin: selected.id === actorId || form.get('admin') === 'on',
              },
            })
          }}
        >
          <fieldset disabled={change.isPending} className="grid gap-4">
            <Input
              label="昵称"
              name="name"
              defaultValue={selected?.name}
              required
              maxLength={60}
            />
            <Input
              label="站点额度"
              name="siteLimit"
              type="number"
              defaultValue={selected?.siteLimit}
              min={0}
              max={10000}
              required
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="admin"
                defaultChecked={selected?.admin}
                disabled={selected?.id === actorId}
              />
              实例管理员
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="disabled"
                defaultChecked={selected?.disabled}
                disabled={selected?.id === actorId}
              />
              停用账号（立即撤销登录，禁止登录和发表评论）
            </label>
          </fieldset>
          {change.error && (
            <p role="alert" className="error-box">
              {errorText(change.error)}
            </p>
          )}
          <Button type="submit" variant="primary" loading={change.isPending}>
            保存用户
          </Button>
        </form>
      </AppDialog>
      <AppDialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null)
        }}
        title="撤销所有登录？"
        description={`${revoke?.name || ''} 的所有设备都需要重新登录。`}
        busy={sessions.isPending}
        alert
      >
        {sessions.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(sessions.error)}
          </p>
        )}
        <Button
          variant="destructive"
          loading={sessions.isPending}
          onClick={() => revoke && sessions.mutate(revoke.id)}
        >
          撤销登录
        </Button>
      </AppDialog>
    </>
  )
}
function Sites() {
  const list = useList<InstanceSites>('sites')
  const refresh = useAdminRefresh()
  const [selected, setSelected] = useState<
    InstanceSites['items'][number] | null
  >(null)
  const [transferTarget, setTransferTarget] = useState<
    InstanceSites['items'][number] | null
  >(null)
  const transfer = useMutation({
    mutationFn: (input: { id: string; email: string }) =>
      api(`admin/sites/${input.id}/transfer`, {
        method: 'POST',
        body: { email: input.email },
      }),
    onSuccess: async () => {
      setTransferTarget(null)
      await refresh()
    },
  })
  const change = useMutation({
    mutationFn: (site: InstanceSites['items'][number]) =>
      api(`admin/sites/${site.id}`, {
        method: 'PATCH',
        body: { enabled: !site.enabled },
      }),
    onSuccess: async () => {
      setSelected(null)
      await refresh()
    },
  })
  return (
    <>
      <Filters
        {...list}
        options={[
          ['all', '全部'],
          ['active', '已启用'],
          ['disabled', '已停用'],
          ['pending', '待验证'],
        ]}
      />
      {list.query.isPending ? (
        <p role="status">正在加载站点…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <>
          <p className="text-muted mb-3">共 {list.query.data.total} 个站点</p>
          <div className="data-list">
            {list.query.data.items.map((site) => (
              <div key={site.id} className="flex-wrap">
                <div className="min-w-0 flex-1 break-words">
                  <p className="font-medium">{site.name}</p>
                  <p className="text-muted break-all">{site.origin}</p>
                  <p className="text-muted break-words">
                    所有者：
                    {site.owners
                      .map((owner) => `${owner.name} (${owner.email})`)
                      .join('、') || '无'}
                  </p>
                </div>
                <span
                  className={`badge ${!site.enabled ? 'spam' : site.verifiedAt ? 'approved' : 'pending'}`}
                >
                  {!site.enabled
                    ? '已停用'
                    : site.verifiedAt
                      ? '已验证'
                      : '待验证'}
                </span>
                <span>{site.comments} 条评论</span>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => {
                      transfer.reset()
                      setTransferTarget(site)
                    }}
                  >
                    转移所有权
                  </Button>
                  <a
                    className="text-link self-center"
                    href={`/?site=${site.id}&view=comments`}
                  >
                    管理评论
                  </a>
                  <Button
                    onClick={() => {
                      change.reset()
                      setSelected(site)
                    }}
                  >
                    {site.enabled ? '停用' : '启用'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!list.query.data.items.length && (
            <p className="empty-state">没有匹配的站点</p>
          )}
        </>
      )}
      <ListPagination list={list} />
      <AppDialog
        open={!!transferTarget}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null)
        }}
        title="转移站点所有权"
        description="新所有者需为有效账号且额度充足。转移后原所有者失去此站点的所有者权限，审核员保持原权限。"
        busy={transfer.isPending}
      >
        <form
          key={transferTarget?.id}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            if (transferTarget)
              transfer.mutate({
                id: transferTarget.id,
                email: String(form.get('email')),
              })
          }}
        >
          <Input
            label="新所有者邮箱"
            name="email"
            type="email"
            required
            maxLength={254}
            disabled={transfer.isPending}
          />
          {transfer.error && (
            <p role="alert" className="error-box">
              {errorText(transfer.error)}
            </p>
          )}
          <Button type="submit" variant="primary" loading={transfer.isPending}>
            确认转移
          </Button>
        </form>
      </AppDialog>
      <AppDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        title={selected?.enabled ? '停用站点？' : '启用站点？'}
        description={
          selected?.enabled
            ? '停用后公开评论、提交和点赞接口不可用，历史内容保留，后台仍可管理。'
            : '启用后已通过验证的站点恢复公开评论服务。'
        }
        busy={change.isPending}
        alert
      >
        {change.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(change.error)}
          </p>
        )}
        <Button
          variant={selected?.enabled ? 'destructive' : 'primary'}
          loading={change.isPending}
          onClick={() => selected && change.mutate(selected)}
        >
          确认{selected?.enabled ? '停用' : '启用'}
        </Button>
      </AppDialog>
    </>
  )
}
function Mail() {
  const list = useList<InstanceMail>('mail')
  const refresh = useAdminRefresh()
  const [notice, setNotice] = useState('')
  const change = useMutation({
    mutationFn: (id: string) =>
      api<{ sent?: number; configured?: boolean }>(
        id === 'flush' ? 'admin/mail/flush' : `admin/mail/${id}/retry`,
        { method: 'POST', body: {} },
      ),
    onSuccess: async (result, id) => {
      setNotice(
        id === 'flush'
          ? result.configured
            ? `本批次已发送 ${result.sent} 封邮件。`
            : 'SMTP 尚未启用，请先配置。'
          : '邮件已重新排队。',
      )
      await refresh()
    },
  })
  return (
    <>
      <div className="flex flex-wrap justify-between items-end gap-3">
        <Filters
          {...list}
          search={false}
          options={[
            ['all', '全部'],
            ['pending', '待发送'],
            ['failed', '重试耗尽'],
            ['sent', '已发送'],
          ]}
        />
        <Button
          className="mb-5"
          loading={change.isPending}
          onClick={() => change.mutate('flush')}
        >
          立即发送一批
        </Button>
      </div>
      <p className="text-muted mb-4">
        每批最多 20 封，失败自动重试至 5 次。持续发送需要配置定时任务。
      </p>
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      {change.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(change.error)}
        </p>
      )}
      {list.query.isPending ? (
        <p role="status">正在加载邮件队列…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <>
          <div className="data-list">
            {list.query.data.items.map((mail) => (
              <div key={mail.id} className="flex-wrap">
                <div className="min-w-0 flex-1 break-words">
                  <p>{mail.subject}</p>
                  <p className="text-muted break-all">{mail.to}</p>
                  <p className="text-muted">
                    尝试 {mail.attempts} 次 ·{' '}
                    {mail.sentAt
                      ? `发送于 ${new Date(mail.sentAt).toLocaleString('zh-CN')}`
                      : `计划 ${new Date(mail.availableAt).toLocaleString('zh-CN')}`}
                  </p>
                  {mail.lastError && (
                    <p className="text-muted">SMTP 发送失败</p>
                  )}
                </div>
                <span
                  className={`badge ${mail.sentAt ? 'approved' : mail.attempts >= 5 ? 'spam' : 'pending'}`}
                >
                  {mail.sentAt
                    ? '已发送'
                    : mail.attempts >= 5
                      ? '重试耗尽'
                      : mail.leaseUntil > Date.now()
                        ? '处理中'
                        : '待发送'}
                </span>
                {!mail.sentAt && (
                  <Button
                    disabled={change.isPending || mail.leaseUntil > Date.now()}
                    onClick={() => change.mutate(mail.id)}
                  >
                    重新排队
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!list.query.data.items.length && (
            <p className="empty-state">暂无邮件</p>
          )}
        </>
      )}
      <ListPagination list={list} />
    </>
  )
}
const actionLabels: Record<string, string> = {
  'user.create': '创建用户',
  'user.delete': '删除用户',
  'site.transfer': '转移站点所有权',
  'settings.update': '更新系统设置',
  'settings.smtp-test': '发送 SMTP 测试邮件',
  'site.create': '创建站点',
  'site.disable': '停用站点',
  'site.enable': '启用站点',
  'user.revoke-sessions': '撤销用户登录',
  'mail.flush': '发送邮件批次',
  'mail.retry': '重新排队邮件',
}
function Audit() {
  const list = useList<InstanceAudit>('audit')
  return (
    <>
      <p className="text-muted mb-4">
        记录用户管理、全局设置、站点启停和邮件运维操作，不包含密码或配置密钥。
      </p>
      {list.query.isPending ? (
        <p role="status">正在加载操作日志…</p>
      ) : list.query.error ? (
        <QueryError error={list.query.error} retry={list.query.refetch} />
      ) : (
        <div className="data-list">
          {list.query.data.items.map((item) => (
            <div key={item.id} className="flex-wrap">
              <div className="min-w-0 flex-1 break-words">
                <p>
                  {item.actorName} ·{' '}
                  {actionLabels[item.action] ||
                    (item.action.startsWith('user.update:')
                      ? '更新用户权限、状态与额度'
                      : item.action)}
                </p>
                <p className="text-muted break-all">{item.target}</p>
                {item.action.startsWith('user.update:') && (
                  <p className="text-muted break-all">{item.action}</p>
                )}
              </div>
              <time className="text-muted">
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </time>
            </div>
          ))}
          {!list.query.data.items.length && (
            <p className="empty-state">暂无操作日志</p>
          )}
        </div>
      )}
      <ListPagination list={list} />
    </>
  )
}
function SystemSettings({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const [dirty, setDirty] = useState(false)
  const [snapshot, setSnapshot] = useState<SafeSystemSettings | null>(null)
  const query = useQuery({
    queryKey: ['instance-admin', 'settings'],
    queryFn: ({ signal }) =>
      api<SafeSystemSettings>('admin/settings', { signal }),
  })
  const [notice, setNotice] = useState('')
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  const save = useMutation({
    mutationFn: (input: SafeSystemSettings) =>
      api<SafeSystemSettings>('admin/settings', {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: async (value) => {
      setDirty(false)
      setSnapshot(null)
      setNotice('系统设置已保存并生效。')
      client.setQueryData(['instance-admin', 'settings'], value)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['auth-config'] }),
        client.invalidateQueries({ queryKey: ['instance-config'] }),
        client.invalidateQueries({ queryKey: ['instance-admin', 'audit'] }),
      ])
    },
  })
  const test = useMutation({
    mutationFn: (to: string) =>
      api('admin/settings/smtp-test', { method: 'POST', body: { to } }),
    onSuccess: async () => {
      setNotice('测试邮件已发送，请检查收件箱。')
      await client.invalidateQueries({ queryKey: ['instance-admin', 'audit'] })
    },
  })
  const [testTo, setTestTo] = useState('')
  if (query.isPending) return <p role="status">正在加载系统设置…</p>
  if (query.error)
    return <QueryError error={query.error} retry={query.refetch} />
  const value = snapshot || query.data
  return (
    <>
      <form
        key={value.revision}
        onChange={() => {
          if (!dirty) setSnapshot(query.data)
          setDirty(true)
          setNotice('')
        }}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const text = (key: string) => String(form.get(key) || '')
          const flag = (key: string) => form.get(key) === 'on'
          save.mutate({
            ...value,
            name: text('name'),
            allowRegistration: flag('allowRegistration'),
            defaultSiteLimit: Number(text('defaultSiteLimit')),
            smtp: {
              enabled: flag('smtp.enabled'),
              host: text('smtp.host'),
              port: Number(text('smtp.port')),
              secure: flag('smtp.secure'),
              username: text('smtp.username'),
              password: text('smtp.password'),
              from: text('smtp.from'),
              clearPassword: flag('smtp.clearPassword'),
            },
          })
        }}
      >
        <fieldset disabled={save.isPending}>
          <section className="settings-section">
            <h2>基本信息与注册</h2>
            <div className="form-width grid gap-5">
              <Input
                label="服务名称"
                name="name"
                defaultValue={value.name}
                required
                maxLength={80}
              />
              <label className="checkbox-label">
                <input
                  name="allowRegistration"
                  type="checkbox"
                  defaultChecked={value.allowRegistration}
                />
                允许新用户注册（邮箱与第三方登录）
              </label>
              <Input
                label="新用户默认站点额度"
                name="defaultSiteLimit"
                type="number"
                defaultValue={value.defaultSiteLimit}
                min={0}
                max={10000}
                required
                description="0 表示不能创建站点。仅影响以后注册的用户，已有用户请在用户管理中调整。"
              />
            </div>
          </section>
          <section className="settings-section">
            <h2>SMTP 邮件</h2>
            <p className="section-description">
              当前来源：
              {value.smtpSource === 'environment'
                ? '环境变量'
                : value.smtpSource === 'database'
                  ? '后台配置'
                  : '未配置'}
              。保存后使用后台 SMTP 配置。密码留空保留已保存值。
            </p>
            <div className="form-width grid gap-5">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="smtp.enabled"
                  defaultChecked={value.smtp.enabled}
                />
                启用 SMTP
              </label>
              <Input
                label="SMTP 主机"
                name="smtp.host"
                defaultValue={value.smtp.host}
                maxLength={254}
                placeholder="smtp.example.com"
              />
              <Input
                label="端口"
                name="smtp.port"
                type="number"
                defaultValue={value.smtp.port}
                required
                min={1}
                max={65535}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="smtp.secure"
                  defaultChecked={value.smtp.secure}
                />
                使用隐式 TLS（通常为 465；587 使用 STARTTLS）
              </label>
              <Input
                label="用户名"
                name="smtp.username"
                defaultValue={value.smtp.username}
                maxLength={254}
                autoComplete="off"
              />
              <Input
                label="密码 / 授权码"
                name="smtp.password"
                type="password"
                autoComplete="new-password"
                maxLength={2000}
                placeholder={
                  value.smtpPasswordSet ? '已配置，留空保留' : '未配置'
                }
              />
              <label className="checkbox-label">
                <input type="checkbox" name="smtp.clearPassword" />
                清除已保存的 SMTP 密码
              </label>
              <Input
                label="发件邮箱"
                name="smtp.from"
                type="email"
                defaultValue={value.smtp.from}
                maxLength={254}
              />
            </div>
          </section>
        </fieldset>
        {save.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(save.error)}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
          disabled={!dirty}
        >
          保存系统设置
        </Button>
        {dirty && <span className="text-muted ml-3">有未保存的修改</span>}
      </form>
      <section className="settings-section mt-6">
        <h2>连接测试</h2>
        <p className="section-description">
          使用已保存的配置进行测试，请先保存修改。
        </p>
        <div className="form-width grid gap-3">
          <Input
            label="测试收件邮箱"
            type="email"
            value={testTo}
            onChange={(event) => setTestTo(event.currentTarget.value)}
            maxLength={254}
          />
          <div className="flex gap-3 flex-wrap">
            <Button
              disabled={dirty || save.isPending || test.isPending || !testTo}
              onClick={() => test.mutate(testTo)}
            >
              发送测试邮件
            </Button>
          </div>
          {test.isPending && <p role="status">正在测试连接…</p>}
          {test.error && (
            <p role="alert" className="error-box">
              {errorText(test.error)}
            </p>
          )}
        </div>
      </section>
      {notice && (
        <p role="status" className="success-box">
          {notice}
        </p>
      )}
    </>
  )
}
