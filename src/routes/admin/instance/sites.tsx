import { createFileRoute } from '@tanstack/react-router'
import { Sites } from '../../../components/instance/sites'

export const Route = createFileRoute('/admin/instance/sites')({
  component: Sites,
})
