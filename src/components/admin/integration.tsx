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
      {detail.role === 'owner' && (
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
          默认使用站点设置中的主题。若要固定主题，可在复制后手动加入{' '}
          <code className="inline-code">data-theme</code> 属性。
        </p>
        <CopyBlock
          text={`<div id="ascs-comments"></div>\n<script src="${origin}/embed.js"\n  data-site="${detail.site.id}"\n  data-target="ascs-comments"\n  defer></script>`}
        />
      </section>
      <section className="settings-section">
        <h2>站点标识</h2>
        <CopyBlock text={detail.site.id} />
      </section>
    </>
  )
}
