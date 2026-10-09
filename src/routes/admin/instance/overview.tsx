import { createFileRoute } from '@tanstack/react-router'
import { Overview } from '../../../components/instance/overview'

export const Route = createFileRoute('/admin/instance/overview')({
  component: Overview,
})
