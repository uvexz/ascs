'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Code, Copy, Check } from 'lucide-react'
import { Site } from './types'

interface EmbedModalProps {
  site: Site | null
  onClose: () => void
}

export function EmbedModal({ site, onClose }: EmbedModalProps) {
  const [copiedCode, setCopiedCode] = useState('')

  if (!site) return null

  const getCurrentHost = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return 'https://your-domain.com'
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(type)
      setTimeout(() => setCopiedCode(''), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('复制失败，请手动复制')
    }
  }

  const basicCode = `<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统 -->
<script
  src="${getCurrentHost()}/comments.js"
  data-page-id="/your-page-path"
  defer>
</script>`

  const advancedCode = `<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统（高级配置） -->
<script
  src="${getCurrentHost()}/comments.js"
  data-page-id="/your-page-path"
  data-ascs-host="${getCurrentHost()}"
  data-container-id="comments"
  defer>
</script>`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              集成代码 - {site.name || site.hostname}
            </CardTitle>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">基本集成</h3>
              <p className="text-sm text-muted-foreground mb-4">
                在你的网页中添加以下代码即可集成评论系统：
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                  <code>{basicCode}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(basicCode, 'basic')}
                >
                  {copiedCode === 'basic' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">高级配置</h3>
              <p className="text-sm text-muted-foreground mb-4">
                你可以通过以下参数自定义评论系统：
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                  <code>{advancedCode}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(advancedCode, 'advanced')}
                >
                  {copiedCode === 'advanced' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">参数说明</h3>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted rounded">
                  <div className="font-medium">data-page-id</div>
                  <div className="text-muted-foreground">可选</div>
                  <div>页面唯一标识符，用于区分不同页面的评论</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted rounded">
                  <div className="font-medium">data-ascs-host</div>
                  <div className="text-muted-foreground">可选</div>
                  <div>ASCS 服务器地址，默认自动检测</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted rounded">
                  <div className="font-medium">data-container-id</div>
                  <div className="text-muted-foreground">可选</div>
                  <div>评论容器的 ID，默认为 &quot;comments&quot;</div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-2">站点信息</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground">站点 ID</div>
                  <div className="font-mono">{site.id}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">域名</div>
                  <div>{site.hostname}</div>
                </div>
                {site.alternateHostnames && (
                  <div className="col-span-2">
                    <div className="font-medium text-muted-foreground">备用域名</div>
                    <div>{site.alternateHostnames}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
