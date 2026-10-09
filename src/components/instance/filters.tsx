import { Input } from '@cloudflare/kumo'

export function Filters({
  q,
  setQ,
  status,
  setStatus,
  options,
  search = true,
}: {
  q: string
  setQ: (value: string) => void
  status: string
  setStatus: (value: string) => void
  options: [string, string][]
  search?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {search && (
        <Input
          label="搜索"
          value={q}
          maxLength={100}
          placeholder="名称或邮箱 / 地址"
          onChange={(event) => setQ(event.currentTarget.value)}
        />
      )}
      <div className="w-40">
        <label className="field-label" htmlFor="instance-filter">
          状态
        </label>
        <select
          id="instance-filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
