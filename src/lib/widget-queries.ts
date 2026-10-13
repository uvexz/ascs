import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { ApiError, api, queryString } from './api'
import { queryKeys, staleTimes } from './query-keys'
import type { CommentList } from '../server/api.server'

export type WidgetConfig = {
  name: string
  allowAnonymous: boolean
  theme: 'auto' | 'light' | 'dark'
  challenge: string
  captcha: string | null
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

/**
 * The widget's config/comments queries. On the server they run through the
 * server functions above so a preloaded loader can render the first page into
 * the HTML; on the client they go straight to the API so the embedded widget's
 * bearer token still authenticates the request.
 */
export const widgetConfigQuery = (params: {
  siteId: string
  pageUrl: string
  pageKey?: string
  theme?: string
  accent?: string
}) =>
  queryOptions({
    queryKey: queryKeys.widgetConfig(
      params.siteId,
      params.pageUrl,
      params.pageKey,
      params.theme,
      params.accent,
    ),
    queryFn: ({ signal }) =>
      typeof window === 'undefined'
        ? fetchConfig({ data: pageInput(params) })
        : api<WidgetConfig>(`config?${queryString(params)}`, { signal }),
    staleTime: staleTimes.static,
  })

export const widgetCommentsQuery = (params: CommentInput) =>
  queryOptions({
    queryKey: queryKeys.commentList(params),
    queryFn: ({ signal }) =>
      typeof window === 'undefined'
        ? fetchComments({ data: params })
        : api<CommentList>(`comments?${queryString(params)}`, { signal }),
  })
