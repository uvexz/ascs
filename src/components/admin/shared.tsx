import {
  ChatCircleIcon,
  ChartBarIcon,
  CodeIcon,
  GearSixIcon,
  UsersIcon,
} from '@phosphor-icons/react'
import type { AdminSearch } from '../../lib/validation'

export type View = AdminSearch['view']
export type Status = AdminSearch['status']
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
