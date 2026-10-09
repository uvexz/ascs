import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { CheckIcon } from '@phosphor-icons/react'
import { api, errorText, fieldError } from '../../lib/api'
import { invalidateSiteCaches } from '../../lib/cache'
import { queryKeys } from '../../lib/query-keys'
import type { SiteSettings } from '../../lib/validation'
import type { SiteDetail } from '../../server/api.server'

export function Settings({
  detail,
  onDirtyChange,
}: {
  detail: SiteDetail
  onDirtyChange: (dirty: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SiteSettings>(() => ({
    name: detail.site.name,
    allowAnonymous: detail.site.allowAnonymous,
    moderation: detail.site.moderation,
    theme: detail.site.theme,
    notificationEmail: detail.site.notificationEmail || '',
    blockedWords: detail.site.blockedWords,
  }))
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!dirty)
      setDraft({
        name: detail.site.name,
        allowAnonymous: detail.site.allowAnonymous,
        moderation: detail.site.moderation,
        theme: detail.site.theme,
        notificationEmail: detail.site.notificationEmail || '',
        blockedWords: detail.site.blockedWords,
      })
  }, [detail, dirty])
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  const update = <TKey extends keyof SiteSettings>(
    key: TKey,
    value: SiteSettings[TKey],
  ) => {
    setDirty(true)
    setNotice('')
    setDraft((previous) => ({ ...previous, [key]: value }))
  }
  const save = useMutation({
    mutationFn: (input: SiteSettings) =>
      api(`sites/${detail.site.id}`, { method: 'PATCH', body: input }),
    onSuccess: async () => {
      setDirty(false)
      setNotice('设置已保存。')
      await Promise.all([
        invalidateSiteCaches(queryClient, detail.site.id),
        // The site name shown in the sidebar picker may have changed.
        queryClient.invalidateQueries({
          queryKey: queryKeys.scope.sitePicker,
        }),
      ])
    },
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate(draft)
      }}
    >
      <section className="settings-section">
        <h2>基本设置</h2>
        <div className="form-width grid gap-5">
          <Input
            label="站点名称"
            name="name"
            value={draft.name}
            onChange={(event) => update('name', event.currentTarget.value)}
            required
            maxLength={80}
            error={fieldError(save.error, 'name')}
          />
          <div>
            <label className="field-label" htmlFor="theme">
              主题
            </label>
            <select
              id="theme"
              name="theme"
              value={draft.theme}
              onChange={(event) =>
                update('theme', event.target.value as SiteSettings['theme'])
              }
            >
              <option value="auto">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>评论与审核</h2>
        <div className="form-width grid gap-5">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="allowAnonymous"
              checked={draft.allowAnonymous}
              onChange={(event) =>
                update('allowAnonymous', event.target.checked)
              }
            />
            允许匿名评论
          </label>
          <div>
            <label className="field-label" htmlFor="moderation">
              审核方式
            </label>
            <select
              name="moderation"
              id="moderation"
              value={draft.moderation}
              onChange={(event) =>
                update(
                  'moderation',
                  event.target.value as SiteSettings['moderation'],
                )
              }
            >
              <option value="all">所有评论需审核</option>
              <option value="anonymous">仅匿名评论需审核</option>
              <option value="none">自动发布</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="blockedWords">
              屏蔽词（每行一个）
            </label>
            <textarea
              name="blockedWords"
              id="blockedWords"
              rows={5}
              maxLength={2000}
              value={draft.blockedWords}
              onChange={(event) =>
                update('blockedWords', event.currentTarget.value)
              }
            />
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>邮件通知</h2>
        <div className="form-width">
          <Input
            label="通知邮箱"
            description="新评论通知会发送到此邮箱，评论者邮箱不会公开。"
            name="notificationEmail"
            type="email"
            maxLength={254}
            value={draft.notificationEmail || ''}
            onChange={(event) =>
              update('notificationEmail', event.currentTarget.value)
            }
            error={fieldError(save.error, 'notificationEmail')}
          />
        </div>
      </section>
      {save.error && (
        <p role="alert" className="error-box mb-4">
          {errorText(save.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="success-box mb-4">
          {notice}
        </p>
      )}
      <Button
        variant="primary"
        icon={CheckIcon}
        loading={save.isPending}
        type="submit"
      >
        保存设置
      </Button>
    </form>
  )
}
