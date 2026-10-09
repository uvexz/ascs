import { useQuery } from '@tanstack/react-query'
import { ApiError, api } from './api'
import { queryKeys } from './query-keys'

const STORAGE_KEY = 'ascs.widget.session'
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

export function useWidgetSession(token: string | null) {
  const query = useQuery({
    queryKey: queryKeys.widgetSession(token),
    enabled: !!token,
    retry: false,
    queryFn: async (): Promise<{ user: WidgetUser } | null> => {
      try {
        return await api<{ user: WidgetUser }>('widget/session')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearWidgetToken()
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
