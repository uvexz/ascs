import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/instance/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/instance/overview' })
  },
})
