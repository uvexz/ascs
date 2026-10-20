/**
 * Central TanStack Query key factory.
 *
 * `queryKeys.*` builds the exact keys passed to `useQuery`.
 * `queryKeys.scope.*` builds prefix keys for `invalidateQueries`, which matches
 * partially (prefix) by default. Keeping both here means a key only ever has to
 * change in one place, so reader and invalidator can never drift apart.
 */
export const queryKeys = {
  // A single dashboard entry per session; the active site is resolved from the
  // returned site list (falling back to the site detail query), so the key must
  // not vary with the selected site. The key is deliberately not scoped by user
  // id: every sign-in/sign-out transition must call `resetAuthCaches` so one
  // account can never read another account's dashboard from the cache.
  dashboard: () => ['dashboard'] as const,
  siteDetail: (siteId?: string) => ['site', siteId] as const,
  sitePicker: (q: string, page: number) => ['site-picker', q, page] as const,
  adminComments: (siteId: string, status: string, page: number) =>
    ['admin-comments', siteId, status, page] as const,
  authConfig: () => ['auth-config'] as const,
  // The profile endpoint always returns the current session's profile, so it is
  // keyed as a singleton rather than by a caller-supplied user id.
  profile: () => ['profile', 'me'] as const,
  profileAccounts: () => ['profile', 'accounts'] as const,
  // The config response only depends on the page identity; theme/accent are
  // presentational and are deliberately not part of the key (or the request).
  widgetConfig: (siteId: string, pageUrl: string, pageKey?: string) =>
    ['widget-config', siteId, pageUrl, pageKey] as const,
  widgetSession: (token: string | null) => ['widget-session', token] as const,
  // One page of root comments for an article.
  commentList: (params: {
    siteId: string
    pageUrl: string
    pageKey?: string
    sort: 'newest' | 'oldest' | 'popular'
    page: number
  }) =>
    [
      'comments',
      params.siteId,
      params.pageUrl,
      params.pageKey,
      'roots',
      params.sort,
      params.page,
    ] as const,
  // The whole conversation under one root comment, loaded as pages by the
  // widget's infinite query (the page number lives in the query data). Replies
  // have a fixed chronological order, so the root list's sort is not part of it.
  commentThread: (params: {
    siteId: string
    pageUrl: string
    pageKey?: string
    rootId: string
  }) =>
    [
      'comments',
      params.siteId,
      params.pageUrl,
      params.pageKey,
      'thread',
      params.rootId,
    ] as const,
  instance: {
    overview: () => ['instance-admin', 'overview'] as const,
    settings: () => ['instance-admin', 'settings'] as const,
    audit: () => ['instance-admin', 'audit'] as const,
    list: (resource: string, q: string, status: string, page: number) =>
      ['instance-admin', resource, q, status, page] as const,
  },
  scope: {
    dashboard: ['dashboard'] as const,
    siteDetail: ['site'] as const,
    sitePicker: ['site-picker'] as const,
    adminComments: (siteId?: string) =>
      siteId
        ? (['admin-comments', siteId] as const)
        : (['admin-comments'] as const),
    comments: (siteId: string) => ['comments', siteId] as const,
    commentsAll: ['comments'] as const,
    // Every root-list page of one article, without touching its discussions.
    commentRoots: (siteId: string, pageUrl: string, pageKey?: string) =>
      ['comments', siteId, pageUrl, pageKey, 'roots'] as const,
    instance: ['instance-admin'] as const,
    instanceResource: (resource: string) =>
      ['instance-admin', resource] as const,
    widgetSession: ['widget-session'] as const,
  },
} as const

/** Shared `staleTime` presets, in milliseconds. */
export const staleTimes = {
  /** Rarely-changing instance metadata (auth providers, widget config). */
  static: 5 * 60_000,
} as const

/**
 * `gcTime` for `staleTimes.static` queries. It must stay above the matching
 * `staleTime`, otherwise "static" data can be garbage-collected at the exact
 * moment it stops being fresh, leaving no headroom over the default 5 minutes.
 */
export const gcTimes = {
  static: 30 * 60_000,
} as const
