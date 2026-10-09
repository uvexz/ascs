import { LocalTime } from '../local-time'
import { QueryError } from '../ui'
import { ListPagination, useList } from './shared'
import type { InstanceAudit } from '../../server/admin.server'

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
export function Audit() {
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
              <LocalTime value={item.createdAt} className="text-muted" />
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
