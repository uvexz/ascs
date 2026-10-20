import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from './api'
import { queryKeys } from './query-keys'

const STORAGE_KEY = 'ascs.widget.session'

/**
 * The bearer token is not used as a query key verbatim: it would leak the
 * credential into cache keys (and devtools) and grow the key with every login.
 * A stable non-cryptographic digest keeps distinct sessions apart.
 */
function tokenKey(token: string) {
  let hash = 5381
  for (let index = 0; index < token.length; index += 1)
    hash = ((hash << 5) + hash + token.charCodeAt(index)) | 0
  return `t${(hash >>> 0).toString(36)}`
}

let currentToken: string | null =
  typeof window === 'undefined'
    ? null
    : (() => {
        try {
          return window.localStorage.getItem(STORAGE_KEY)
        } catch {
          return null
        }
      })()

export function getWidgetToken() {
  return currentToken
}
export function setWidgetToken(token: string) {
  currentToken = token
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    /* Third-party storage may be blocked; the in-memory token still works. */
  }
}
export function clearWidgetToken() {
  currentToken = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export type WidgetUser = { id: string; name: string; image: string | null }

export function useWidgetSession(
  token: string | null,
  // Lets the owner of the token state (the embedded widget) drop a rejected
  // token; otherwise the query key would keep pointing at a dead session while
  // `api()` silently stops sending the Authorization header.
  onTokenInvalid?: () => void,
) {
  const query = useQuery({
    queryKey: queryKeys.widgetSession(token ? tokenKey(token) : null),
    enabled: !!token,
    retry: false,
    queryFn: async ({ signal }): Promise<{ user: WidgetUser } | null> => {
      try {
        return await api<{ user: WidgetUser }>('widget/session', { signal })
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearWidgetToken()
          onTokenInvalid?.()
          return null
        }
        throw error
      }
    },
  })
  return {
    data: token ? (query.data ?? null) : null,
    isPending: !!token && query.isPending,
    refetch: query.refetch,
  }
}
