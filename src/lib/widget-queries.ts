import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { ApiError, api, queryString } from './api'
import { gcTimes, queryKeys, staleTimes } from './query-keys'
import type { CommentList } from '../server/api.server'
import type { CaptchaWasm } from '../server/captcha.server'

export type WidgetConfig = {
  name: string
  allowAnonymous: boolean
  theme: 'auto' | 'light' | 'dark'
  challenge: string
  captcha: string | null
  captchaWasm: CaptchaWasm | null
}

type PageInput = { siteId: string; pageUrl: string; pageKey?: string }
type CommentInput = PageInput & {
  sort: 'newest' | 'oldest' | 'popular'
  page: number
}

/**
 * Server-side twin of the `/api/v1/*` GETs the widget makes. It drives the very
 * same `handleApi` handler against a synthesized request built from the incoming
 * document request, so the public endpoints keep a single implementation and the
 * anonymous voter cookie is still set on the SSR response.
 */
async function serverGet<T>(path: string): Promise<T> {
  const [{ handleApi }, { getRequest, setResponseHeader }] = await Promise.all([
    import('../server/api.server'),
    import('@tanstack/react-start/server'),
  ])
  const request = getRequest()
  const url = new URL(`/api/v1/${path}`, request.url)
  const response = await handleApi(
    new Request(url, { headers: request.headers }),
  )
  const cookie = response.headers.get('set-cookie')
  if (cookie) setResponseHeader('set-cookie', cookie)
  const payload: { error?: string } = await response.json()
  if (!response.ok) throw new ApiError(response.status, payload.error || '')
  return payload as T
}

const fetchConfig = createServerFn({ method: 'GET' })
  .validator((input: PageInput) => input)
  .handler(({ data }) => serverGet<WidgetConfig>(`config?${queryString(data)}`))

const fetchComments = createServerFn({ method: 'GET' })
  .validator((input: CommentInput) => input)
  .handler(({ data }) =>
    serverGet<CommentList>(`comments?${queryString(data)}`),
  )

const pageInput = ({ siteId, pageUrl, pageKey }: PageInput): PageInput => ({
  siteId,
  pageUrl,
  ...(pageKey ? { pageKey } : {}),
})

/** The exact fields the comments endpoint accepts; never forward the whole
 * widget options object (it also carries presentational and moderation-only
 * fields, which would make the request differ from what the query key implies). */
const commentInput = ({
  siteId,
  pageUrl,
  pageKey,
  sort,
  page,
}: CommentInput): CommentInput => ({
  siteId,
  pageUrl,
  ...(pageKey ? { pageKey } : {}),
  sort,
  page,
})

/**
 * The widget's config/comments queries. On the server they run through the
 * server functions above so a preloaded loader can render the first page into
 * the HTML; on the client they go straight to the API so the embedded widget's
 * bearer token still authenticates the request.
 */
export const widgetConfigQuery = (params: PageInput) =>
  queryOptions({
    // The response only depends on the page identity. Theme/accent and the
    // article context are not part of the key (or the request).
    queryKey: queryKeys.widgetConfig(
      params.siteId,
      params.pageUrl,
      params.pageKey,
    ),
    queryFn: ({ signal }) =>
      typeof window === 'undefined'
        ? fetchConfig({ data: pageInput(params) })
        : api<WidgetConfig>(`config?${queryString(pageInput(params))}`, {
            signal,
          }),
    staleTime: staleTimes.static,
    gcTime: gcTimes.static,
    // The payload includes a short-lived anti-bot challenge (the server only
    // accepts it between 1.5s and one hour old). Rotate it while the widget
    // stays open; posting also refreshes it explicitly.
    refetchInterval: 15 * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })

export const widgetCommentsQuery = (params: CommentInput) =>
  queryOptions({
    queryKey: queryKeys.commentList(params),
    queryFn: ({ signal }) => {
      const input = commentInput(params)
      return typeof window === 'undefined'
        ? fetchComments({ data: input })
        : api<CommentList>(`comments?${queryString(input)}`, { signal })
    },
    // A focus refetch here would refetch the root list; every expanded
    // discussion query would follow, multiplying requests by the number of
    // visible root comments. Freshness is driven by posting/login instead.
    refetchOnWindowFocus: false,
  })
