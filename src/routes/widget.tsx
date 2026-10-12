import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CommentWidget } from '../components/comment-widget'
import { ErrorBoundary } from '../components/ui'
import { id, themeSchema } from '../lib/validation'

const search = z.object({
  siteId: id,
  pageUrl: z.string().url().max(2000),
  // A numeric page key reaches this as a number because the router JSON-parses
  // search params; normalize either form to the string the API expects.
  pageKey: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .pipe(z.string().min(1).max(300))
    .optional(),
  theme: themeSchema.optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  // The router JSON-parses search params, so `border=true` arrives as a boolean
  // rather than a string; accept both and keep only the enabled flag.
  border: z
    .union([z.boolean(), z.literal('true')])
    .transform((value) =>
      value === true || value === 'true' ? ('true' as const) : undefined,
    )
    .optional(),
})
export const Route = createFileRoute('/widget')({
  ssr: false,
  validateSearch: (input: Record<string, unknown>) => search.parse(input),
  head: () => ({
    meta: [{ title: 'ASCS · 评论' }, { name: 'robots', content: 'noindex' }],
  }),
  component: () => (
    <ErrorBoundary>
      <CommentWidget options={Route.useSearch()} />
    </ErrorBoundary>
  ),
})
