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
  // not vary with the selected site.
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
  widgetConfig: (
    siteId: string,
    pageUrl: string,
    pageKey: string | undefined,
    theme: string | undefined,
    accent: string | undefined,
  ) => ['widget-config', siteId, pageUrl, pageKey, theme, accent] as const,
  widgetSession: (token: string | null) => ['widget-session', token] as const,
  commentList: (params: {
    siteId: string
    pageUrl: string
    pageKey?: string
    parentId?: string
    sort: 'newest' | 'oldest' | 'popular'
    page: number
  }) =>
    [
      'comments',
      params.siteId,
      params.pageUrl,
      params.pageKey,
      params.parentId,
      params.sort,
      params.page,
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
