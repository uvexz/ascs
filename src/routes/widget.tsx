import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CommentWidget } from '../components/comment-widget'
import { ErrorBoundary } from '../components/ui'
import { id, themeSchema } from '../lib/validation'

const hexColor = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/**
 * `data-background` may carry an image URL, which ends up inside a CSS
 * `url("...")`, so reject quotes, backslashes and whitespace that could break
 * out of the wrapper, along with non-http(s) schemes and embedded credentials.
 */
function isSafeBackgroundImage(value: string) {
  if (!/^https?:\/\//i.test(value) || /["'\\\s<>]/.test(value)) return false
  try {
    const url = new URL(value)
    return !url.username && !url.password
  } catch {
    return false
  }
}

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
  // A hex color (3/4/6/8 digits, the 4- and 8-digit forms carrying alpha) or an
  // image URL. Both are purely presentational, so an unusable value is dropped
  // instead of failing the whole page.
  background: z
    .string()
    .max(2000)
    .refine((value) => hexColor.test(value) || isSafeBackgroundImage(value))
    .optional()
    .catch(undefined),
  // Extra transparency for either form, since an image has no alpha channel.
  backgroundOpacity: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .pipe(z.number().min(0).max(1))
    .optional()
    .catch(undefined),
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
