import { createFileRoute } from '@tanstack/react-router'
import { ProfilePage } from '../components/profile-page'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { emailChange?: string } => ({
    emailChange:
      typeof search.emailChange === 'string' ? search.emailChange : undefined,
  }),
  head: () => ({ meta: [{ title: '个人设置 · ASCS' }] }),
})
