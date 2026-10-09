import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '../components/profile-page'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  ssr: false,
  head: () => ({ meta: [{ title: '个人设置 · ASCS' }] }),
})
