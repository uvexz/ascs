import {
  ChatCircleIcon,
  ChartBarIcon,
  CodeIcon,
  GearSixIcon,
  UsersIcon,
  GaugeIcon,
  UsersThreeIcon,
  GlobeIcon,
  EnvelopeSimpleIcon,
  ClipboardTextIcon,
} from '@phosphor-icons/react'
import type { CommentSearch } from '../../lib/validation'

export type Status = CommentSearch['status']
export const statusLabels: Record<Status, string> = {
  pending: '待审核',
  approved: '已发布',
  spam: '垃圾评论',
  deleted: '已删除',
  all: '全部',
}
export const navigation = [
  { id: 'comments', label: '评论', icon: ChatCircleIcon },
  { id: 'statistics', label: '统计', icon: ChartBarIcon },
  { id: 'integration', label: '集成', icon: CodeIcon },
  { id: 'settings', label: '站点设置', icon: GearSixIcon },
  { id: 'members', label: '成员与封禁', icon: UsersIcon },
] as const
export const systemNavigation = [
  { id: 'overview', label: '系统概览', icon: GaugeIcon },
  { id: 'users', label: '用户管理', icon: UsersThreeIcon },
  { id: 'sites', label: '全部站点', icon: GlobeIcon },
  { id: 'settings', label: '系统设置', icon: GearSixIcon },
  { id: 'mail', label: '邮件队列', icon: EnvelopeSimpleIcon },
  { id: 'audit', label: '操作日志', icon: ClipboardTextIcon },
] as const

/** Label of the admin view rendered for a pathname (falls back to the brand). */
export function viewLabel(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  const item = [...navigation, ...systemNavigation].find(
    (entry) => entry.id === segment,
  )
  return item?.label
}
