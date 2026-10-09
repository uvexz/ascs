import {
  ClipboardTextIcon,
  EnvelopeSimpleIcon,
  GaugeIcon,
  GearSixIcon,
  GlobeIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react'
import { Audit } from './instance/audit'
import { Mail } from './instance/mail'
import { Overview } from './instance/overview'
import { Sites } from './instance/sites'
import { SystemSettings } from './instance/system-settings'
import { Users } from './instance/users'
import type { AdminSearch } from '../lib/validation'

export const systemNavigation = [
  { id: 'system-overview', label: '系统概览', icon: GaugeIcon },
  { id: 'users', label: '用户管理', icon: UsersThreeIcon },
  { id: 'all-sites', label: '全部站点', icon: GlobeIcon },
  { id: 'system-settings', label: '系统设置', icon: GearSixIcon },
  { id: 'mail', label: '邮件队列', icon: EnvelopeSimpleIcon },
  { id: 'audit', label: '操作日志', icon: ClipboardTextIcon },
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
