import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, queryString } from '../../lib/api'
import { invalidateInstanceCaches } from '../../lib/cache'
import { Pagination } from '../pagination'

export function useList<T>(resource: string) {
  const [q, setSearch] = useState('')
  const [status, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['instance-admin', resource, q, status, page],
    queryFn: ({ signal }) =>
      api<T>(`admin/${resource}?${queryString({ q, status, page })}`, {
        signal,
      }),
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
    if (list.query.data && list.query.data.page !== list.page)
      list.setPage(list.query.data.page)
  }, [list.query.data, list.page, list.setPage])
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
