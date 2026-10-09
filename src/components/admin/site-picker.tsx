import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Popover, Sidebar } from '@cloudflare/kumo'
import {
  CaretUpDownIcon,
  CheckIcon,
  GlobeIcon,
  PlusIcon,
} from '@phosphor-icons/react'
import { api, errorText, queryString } from '../../lib/api'
import { Pagination } from '../pagination'
import type { SiteList } from '../../server/api.server'

export function SiteSwitcher({
  currentId,
  currentName,
  onSelect,
  canCreate = false,
  ownedSites,
  siteLimit,
  onAdd,
}: {
  currentId?: string
  currentName?: string
  onSelect: (id: string) => void
  canCreate?: boolean
  ownedSites?: number
  siteLimit?: number
  onAdd: () => void
}) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const list = useQuery({
    queryKey: ['site-picker', q, page],
    queryFn: ({ signal }) =>
      api<SiteList>(`sites?${queryString({ q, page })}`, { signal }),
  })
  const items = list.data?.items ?? []
  const options =
    currentId && !items.some((site) => site.id === currentId)
      ? [{ id: currentId, name: currentName || '当前站点' }, ...items]
      : items
  return (
    <Sidebar.MenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          render={
            <Sidebar.MenuButton
              icon={GlobeIcon}
              active={open}
              tooltip={currentName ? `切换站点：${currentName}` : '选择站点'}
            >
              <span className="truncate">{currentName || '暂无站点'}</span>
              <CaretUpDownIcon
                size={13}
                className="ml-auto shrink-0 opacity-60 group-data-[state=collapsed]/sidebar:hidden"
              />
            </Sidebar.MenuButton>
          }
        />
        <Popover.Content
          side="right"
          align="start"
          sideOffset={8}
          className="site-popover"
        >
          <Input
            label="搜索站点"
            value={q}
            maxLength={100}
            placeholder="名称或地址"
            onChange={(event) => {
              setQ(event.currentTarget.value)
              setPage(1)
            }}
          />
          <ul className="site-popover-list">
            {!options.length && (
              <li className="site-popover-empty">暂无站点</li>
            )}
            {options.map((site) => (
              <li key={site.id}>
                <button
                  type="button"
                  className="site-option"
                  data-active={site.id === currentId || undefined}
                  aria-current={site.id === currentId ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false)
                    onSelect(site.id)
                  }}
                >
                  <span className="truncate">{site.name}</span>
                  {site.id === currentId && (
                    <CheckIcon
                      size={15}
                      className="site-option-check"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
          {list.error && (
            <p role="alert" className="error-box mt-2">
              {errorText(list.error)}
            </p>
          )}
          {list.data && list.data.totalPages > 1 && (
            <Pagination
              page={list.data.page}
              setPage={setPage}
              hasMore={list.data.hasMore}
              totalPages={list.data.totalPages}
              loading={list.isFetching}
            />
          )}
          {canCreate && (
            <div className="site-popover-footer">
              <Button
                icon={PlusIcon}
                onClick={() => {
                  setOpen(false)
                  onAdd()
                }}
              >
                添加站点
              </Button>
              {ownedSites !== undefined && siteLimit !== undefined && (
                <p className="text-muted">
                  站点额度：{ownedSites} / {siteLimit}
                </p>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover>
    </Sidebar.MenuItem>
  )
}
