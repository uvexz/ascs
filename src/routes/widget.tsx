import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CommentWidget } from '../components/comment-widget'
import { id, themeSchema } from '../lib/validation'
const search = z.object({ siteId: id, pageUrl: z.string().url().max(2000), pageKey: z.string().min(1).max(300).optional(), theme: themeSchema.optional(), accent: z.string().regex(/^#[0-9a-f]{6}$/i).optional() })
export const Route = createFileRoute('/widget')({
  ssr: false,
  validateSearch: (input: Record<string, unknown>) => search.parse(input),
  head: () => ({ meta: [{ title: 'ASCS · 评论' }, { name: 'robots', content: 'noindex' }] }),
  component: () => <CommentWidget options={Route.useSearch()} />,
})
