import { createFileRoute } from '@tanstack/react-router'
import { AdminApp } from '../components/admin-app'
import { adminSearch } from '../lib/validation'

export const Route = createFileRoute('/')({
  component: AdminApp,
  ssr: false,
  validateSearch: (input) => adminSearch.parse(input),
})
