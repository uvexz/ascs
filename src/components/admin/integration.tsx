import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@cloudflare/kumo'
import { ShieldCheckIcon } from '@phosphor-icons/react'
import { api, errorText } from '../../lib/api'
import { invalidateSiteCaches } from '../../lib/cache'
import { CopyBlock } from './copy-block'
import type { SiteDetail } from '../../server/api.server'

export function Integration({ detail }: { detail: SiteDetail }) {
  const queryClient = useQueryClient()
  const verify = useMutation({
    mutationFn: () =>
      api(`sites/${detail.site.id}/verify`, { method: 'POST', body: {} }),
    onSuccess: async () => {
      await invalidateSiteCaches(queryClient, detail.site.id)
    },
  })
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  const hostname = new URL(detail.site.origin).hostname
  return (
    <>
      {detail.role === 'owner' && !detail.site.verifiedAt && (
        <section className="settings-section">
          <div className="section-heading">
            <h2>域名验证</h2>
            <span
              className={`badge ${detail.site.verifiedAt ? 'approved' : 'pending'}`}
            >
              {detail.site.verifiedAt ? '已验证' : '待验证'}
            </span>
          </div>
          <p className="section-description">
            在 DNS 服务商添加 TXT 记录后，等待记录生效，再点击“检查验证”。
          </p>
          <dl className="definition-list">
            <div>
              <dt>站点地址</dt>
              <dd>{detail.site.origin}</dd>
            </div>
            <div>
              <dt>TXT 主机记录</dt>
              <dd>
                <code>_ascs.{hostname}</code>
              </dd>
            </div>
            <div>
              <dt>TXT 记录值</dt>
              <dd>
                <CopyBlock
                  text={`ascs-verification=${detail.site.verificationToken}`}
                />
              </dd>
            </div>
          </dl>
          <Button
            icon={ShieldCheckIcon}
            variant="primary"
            loading={verify.isPending}
            onClick={() => verify.mutate()}
          >
            检查验证
          </Button>
          {verify.error && (
            <p role="alert" className="error-box mt-4">
              {errorText(verify.error)}
            </p>
          )}
          {verify.isSuccess && (
            <p role="status" className="success-box mt-4">
              站点验证通过
            </p>
          )}
        </section>
      )}
      <section className="settings-section">
        <h2>嵌入代码</h2>
        <p className="section-description">
          将代码放在文章模板中希望显示评论的位置。
        </p>
        <CopyBlock
          text={`<div id="ascs-comments"></div>\n<script src="${origin}/embed.js"\n  data-site="${detail.site.id}"\n  data-target="ascs-comments"\n  defer></script>`}
        />
      </section>
      <section className="settings-section">
        <h2>自定义样式</h2>
        <p className="section-description">
          评论区运行在独立的 iframe 中，博客 CSS 无法直接修改其样式。可在 script
          标签上添加以下属性调整外观。
        </p>
        <dl className="definition-list">
          <div>
            <dt>
              <code>data-theme</code>
            </dt>
            <dd>
              <code>auto</code>（跟随系统）、<code>light</code>（浅色）或{' '}
              <code>dark</code>（深色）。设置后覆盖站点设置中的主题。
            </dd>
          </div>
          <div>
            <dt>
              <code>data-accent</code>
            </dt>
            <dd>
              6 位十六进制颜色，例如 <code>#267265</code>
              。作用于主要按钮和复选框，请选择与白色文字对比足够的颜色。
            </dd>
          </div>
          <div>
            <dt>
              <code>data-border</code>
            </dt>
            <dd>
              为评论区添加边框和圆角，默认无边框。添加该属性即可开启，设为{' '}
              <code>false</code> 则关闭。
            </dd>
          </div>
        </dl>
        <CopyBlock
          text={`<div id="ascs-comments"></div>\n<script src="${origin}/embed.js"\n  data-site="${detail.site.id}"\n  data-target="ascs-comments"\n  data-theme="auto"\n  data-accent="#267265"\n  data-border\n  defer></script>`}
        />
      </section>
      <section className="settings-section">
        <h2>站点标识</h2>
        <CopyBlock text={detail.site.id} />
      </section>
    </>
  )
}
