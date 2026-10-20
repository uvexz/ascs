import { useEffect, useState } from 'react'
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api, queryString } from '../../lib/api'
import { invalidateInstanceCaches } from '../../lib/cache'
import { queryKeys } from '../../lib/query-keys'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { Pagination } from '../pagination'

export function useList<T>(resource: string) {
  const [q, setSearch] = useState('')
  const [status, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  // Typing must not create one query (and one request) per keystroke; the input
  // above stays responsive because only the query key is debounced.
  const debouncedQuery = useDebouncedValue(q)
  const query = useQuery({
    queryKey: queryKeys.instance.list(resource, debouncedQuery, status, page),
    queryFn: ({ signal }) =>
      api<T>(
        `admin/${resource}?${queryString({
          q: debouncedQuery,
          status,
          page,
        })}`,
        { signal },
      ),
    // Paging/filtering keeps the previous rows visible instead of unmounting
    // the list into its pending state.
    placeholderData: keepPreviousData,
  })
  return {
    query,
    q,
    status,
    page,
    setPage,
    setQ: (value: string) => {
      setSearch(value)
      setPage(1)
    },
    setStatus: (value: string) => {
      setFilter(value)
      setPage(1)
    },
  }
}
export function ListPagination({
  list,
}: {
  list: {
    page: number
    setPage: (value: number) => void
    query: {
      isFetching: boolean
      data?: { page: number; hasMore: boolean; totalPages: number }
    }
  }
}) {
  useEffect(() => {
    // `data` may be placeholder data from the previous page while the next one
    // is in flight; only reconcile the page once the response actually arrived.
    if (list.query.isFetching) return
    if (list.query.data && list.query.data.page !== list.page)
      list.setPage(list.query.data.page)
  }, [list.query.data, list.query.isFetching, list.page, list.setPage])
  return (
    <Pagination
      page={list.query.data?.page || list.page}
      setPage={list.setPage}
      hasMore={!!list.query.data?.hasMore}
      totalPages={list.query.data?.totalPages}
      loading={list.query.isFetching}
    />
  )
}
export function useAdminRefresh() {
  const client = useQueryClient()
  return () => invalidateInstanceCaches(client)
}
