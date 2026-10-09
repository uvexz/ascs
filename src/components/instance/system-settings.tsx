import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@cloudflare/kumo'
import { api, errorText } from '../../lib/api'
import { QueryError } from '../ui'
import type { SafeSystemSettings } from '../../lib/system-settings'

export function SystemSettings({
  onDirtyChange,
}: {
  onDirtyChange: (dirty: boolean) => void
}) {
  const client = useQueryClient()
  const [dirty, setDirty] = useState(false)
  const [snapshot, setSnapshot] = useState<SafeSystemSettings | null>(null)
  const query = useQuery({
    queryKey: ['instance-admin', 'settings'],
    queryFn: ({ signal }) =>
      api<SafeSystemSettings>('admin/settings', { signal }),
  })
  const [notice, setNotice] = useState('')
  useEffect(() => {
    onDirtyChange(dirty)
    return () => onDirtyChange(false)
  }, [dirty, onDirtyChange])
  const save = useMutation({
    mutationFn: (input: SafeSystemSettings) =>
      api<SafeSystemSettings>('admin/settings', {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: async (value) => {
      setDirty(false)
      setSnapshot(null)
      setNotice('系统设置已保存并生效。')
      client.setQueryData(['instance-admin', 'settings'], value)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['auth-config'] }),
        client.invalidateQueries({ queryKey: ['instance-config'] }),
        client.invalidateQueries({ queryKey: ['instance-admin', 'audit'] }),
      ])
    },
  })
  const test = useMutation({
    mutationFn: (to: string) =>
      api('admin/settings/smtp-test', { method: 'POST', body: { to } }),
    onSuccess: async () => {
      setNotice('测试邮件已发送，请检查收件箱。')
      await client.invalidateQueries({ queryKey: ['instance-admin', 'audit'] })
    },
  })
  const [testTo, setTestTo] = useState('')
  if (query.isPending) return <p role="status">正在加载系统设置…</p>
  if (query.error)
    return <QueryError error={query.error} retry={query.refetch} />
  const value = snapshot || query.data
  return (
    <>
      <form
        key={value.revision}
        onChange={() => {
          if (!dirty) setSnapshot(query.data)
          setDirty(true)
          setNotice('')
        }}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const text = (key: string) => String(form.get(key) || '')
          const flag = (key: string) => form.get(key) === 'on'
          save.mutate({
            ...value,
            name: text('name'),
            allowRegistration: flag('allowRegistration'),
            defaultSiteLimit: Number(text('defaultSiteLimit')),
            smtp: {
              enabled: flag('smtp.enabled'),
              host: text('smtp.host'),
              port: Number(text('smtp.port')),
              secure: flag('smtp.secure'),
              username: text('smtp.username'),
              password: text('smtp.password'),
              from: text('smtp.from'),
              clearPassword: flag('smtp.clearPassword'),
            },
          })
        }}
      >
        <fieldset disabled={save.isPending}>
          <section className="settings-section">
            <h2>基本信息与注册</h2>
            <div className="form-width grid gap-5">
              <Input
                label="服务名称"
                name="name"
                defaultValue={value.name}
                required
                maxLength={80}
              />
              <label className="checkbox-label">
                <input
                  name="allowRegistration"
                  type="checkbox"
                  defaultChecked={value.allowRegistration}
                />
                允许新用户注册（邮箱与第三方登录）
              </label>
              <Input
                label="新用户默认站点额度"
                name="defaultSiteLimit"
                type="number"
                defaultValue={value.defaultSiteLimit}
                min={0}
                max={10000}
                required
                description="0 表示不能创建站点。仅影响以后注册的用户，已有用户请在用户管理中调整。"
              />
            </div>
          </section>
          <section className="settings-section">
            <h2>SMTP 邮件</h2>
            <p className="section-description">
              当前来源：
              {value.smtpSource === 'environment'
                ? '环境变量'
                : value.smtpSource === 'database'
                  ? '后台配置'
                  : '未配置'}
              。保存后使用后台 SMTP 配置。密码留空保留已保存值。
            </p>
            <div className="form-width grid gap-5">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="smtp.enabled"
                  defaultChecked={value.smtp.enabled}
                />
                启用 SMTP
              </label>
              <Input
                label="SMTP 主机"
                name="smtp.host"
                defaultValue={value.smtp.host}
                maxLength={254}
                placeholder="smtp.example.com"
              />
              <Input
                label="端口"
                name="smtp.port"
                type="number"
                defaultValue={value.smtp.port}
                required
                min={1}
                max={65535}
              />
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="smtp.secure"
                  defaultChecked={value.smtp.secure}
                />
                使用隐式 TLS（通常为 465；587 使用 STARTTLS）
              </label>
              <Input
                label="用户名"
                name="smtp.username"
                defaultValue={value.smtp.username}
                maxLength={254}
                autoComplete="off"
              />
              <Input
                label="密码 / 授权码"
                name="smtp.password"
                type="password"
                autoComplete="new-password"
                maxLength={2000}
                placeholder={
                  value.smtpPasswordSet ? '已配置，留空保留' : '未配置'
                }
              />
              <label className="checkbox-label">
                <input type="checkbox" name="smtp.clearPassword" />
                清除已保存的 SMTP 密码
              </label>
              <Input
                label="发件邮箱"
                name="smtp.from"
                type="email"
                defaultValue={value.smtp.from}
                maxLength={254}
              />
            </div>
          </section>
        </fieldset>
        {save.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(save.error)}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={save.isPending}
          disabled={!dirty}
        >
          保存系统设置
        </Button>
        {dirty && <span className="text-muted ml-3">有未保存的修改</span>}
      </form>
      <section className="settings-section mt-6">
        <h2>连接测试</h2>
        <p className="section-description">
          使用已保存的配置进行测试，请先保存修改。
        </p>
        <div className="form-width grid gap-3">
          <Input
            label="测试收件邮箱"
            type="email"
            value={testTo}
            onChange={(event) => setTestTo(event.currentTarget.value)}
            maxLength={254}
          />
          <div className="flex gap-3 flex-wrap">
            <Button
              disabled={dirty || save.isPending || test.isPending || !testTo}
              onClick={() => test.mutate(testTo)}
            >
              发送测试邮件
            </Button>
          </div>
          {test.isPending && <p role="status">正在测试连接…</p>}
          {test.error && (
            <p role="alert" className="error-box">
              {errorText(test.error)}
            </p>
          )}
        </div>
      </section>
      {notice && (
        <p role="status" className="success-box">
          {notice}
        </p>
      )}
    </>
  )
}
