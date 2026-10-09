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
  {
    id: 'comments',
    label: '评论',
    icon: ChatCircleIcon,
    to: '/admin/site/$siteId/comments',
  },
  {
    id: 'statistics',
    label: '统计',
    icon: ChartBarIcon,
    to: '/admin/site/$siteId/statistics',
  },
  {
    id: 'integration',
    label: '集成',
    icon: CodeIcon,
    to: '/admin/site/$siteId/integration',
  },
  {
    id: 'settings',
    label: '站点设置',
    icon: GearSixIcon,
    to: '/admin/site/$siteId/settings',
  },
  {
    id: 'members',
    label: '成员与封禁',
    icon: UsersIcon,
    to: '/admin/site/$siteId/members',
  },
] as const
export const systemNavigation = [
  {
    id: 'overview',
    label: '系统概览',
    icon: GaugeIcon,
    to: '/admin/instance/overview',
  },
  {
    id: 'users',
    label: '用户管理',
    icon: UsersThreeIcon,
    to: '/admin/instance/users',
  },
  {
    id: 'sites',
    label: '全部站点',
    icon: GlobeIcon,
    to: '/admin/instance/sites',
  },
  {
    id: 'settings',
    label: '系统设置',
    icon: GearSixIcon,
    to: '/admin/instance/settings',
  },
  {
    id: 'mail',
    label: '邮件队列',
    icon: EnvelopeSimpleIcon,
    to: '/admin/instance/mail',
  },
  {
    id: 'audit',
    label: '操作日志',
    icon: ClipboardTextIcon,
    to: '/admin/instance/audit',
  },
] as const
export type SiteViewId = (typeof navigation)[number]['id']

/** Label of the admin view rendered for a pathname (falls back to the brand). */
export function viewLabel(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1)
  const item = [...navigation, ...systemNavigation].find(
    (entry) => entry.id === segment,
  )
  return item?.label
}
