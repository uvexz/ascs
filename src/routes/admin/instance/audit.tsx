import { createFileRoute } from '@tanstack/react-router'
import { Audit } from '../../../components/instance/audit'

export const Route = createFileRoute('/admin/instance/audit')({
  component: Audit,
})
