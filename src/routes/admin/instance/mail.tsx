import { createFileRoute } from '@tanstack/react-router'
import { Mail } from '../../../components/instance/mail'

export const Route = createFileRoute('/admin/instance/mail')({
  component: Mail,
})
