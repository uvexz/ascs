'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code, Download, Settings, Globe, MessageSquare, Mail, Send } from 'lucide-react'
import { getCurrentHost } from '@/lib/utils'

export default function DocsPage() {
  const [currentHost, setCurrentHost] = useState('your-domain.com')

  useEffect(() => {
    setCurrentHost(getCurrentHost())
  }, [])
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">配置教程</h1>
            <p className="text-lg text-muted-foreground">
              详细的部署和配置指南，帮助你快速上手 ASCS 评论系统
            </p>
          </div>

          <Tabs defaultValue="embed" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="embed">嵌入</TabsTrigger>
              <TabsTrigger value="config">配置</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
            </TabsList>

            {/* 嵌入教程 */}
            <TabsContent value="embed" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    嵌入到网站
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">基础嵌入</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      在你的 HTML 页面中添加以下代码：
                    </p>
                    <div className="bg-muted p-4 rounded-md">
                      <pre className="text-sm">
{`<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统 -->
<script src="${currentHost}/comments.js" defer></script>`}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Script标签配置（推荐）</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      你可以将所有配置直接写在script标签上：
                    </p>
                    <div className="bg-muted p-4 rounded-md">
                      <pre className="text-sm">
{`<div id="comments"></div>

<script
  src="${currentHost}/comments.js"
  data-page-id="blog/my-awesome-post"
  data-ascs-host="${currentHost}"
  data-container-id="comments"
  defer>
</script>`}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">配置选项</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">属性</th>
                            <th className="text-left p-2">说明</th>
                            <th className="text-left p-2">默认值</th>
                            <th className="text-left p-2">示例</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2"><code>data-page-id</code></td>
                            <td className="p-2">自定义页面标识符</td>
                            <td className="p-2">当前页面路径</td>
                            <td className="p-2"><code>blog/post-1</code></td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><code>data-ascs-host</code></td>
                            <td className="p-2">评论系统服务器地址</td>
                            <td className="p-2">脚本所在域名</td>
                            <td className="p-2"><code>{currentHost}</code></td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><code>data-container-id</code></td>
                            <td className="p-2">评论容器的ID</td>
                            <td className="p-2"><code>comments</code></td>
                            <td className="p-2"><code>my-comments</code></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Alert>
                    <Code className="h-4 w-4" />
                    <AlertDescription>
                      Script标签配置的优先级高于容器配置，你可以混合使用两种方式
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 系统配置 */}
            <TabsContent value="config" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    系统配置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      邮件通知配置
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      配置 SMTP 服务器以启用邮件通知功能：
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>SMTP 服务器：如 smtp.gmail.com</li>
                      <li>SMTP 端口：通常为 587 (TLS) 或 465 (SSL)</li>
                      <li>SMTP 用户名：你的邮箱地址</li>
                      <li>SMTP 密码：邮箱密码或应用专用密码</li>
                      <li>发件人地址：显示的发件人信息</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Telegram 通知配置
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      配置 Telegram Bot 以接收新评论通知：
                    </p>
                    <ol className="list-decimal list-inside text-sm space-y-1">
                      <li>与 @BotFather 对话创建机器人，获取 Bot Token</li>
                      <li>将机器人添加到群组或频道</li>
                      <li>发送消息后访问 <code>https://api.telegram.org/bot[TOKEN]/getUpdates</code> 获取 Chat ID</li>
                    </ol>
                  </div>

                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertDescription>
                      所有配置都可以在管理后台的系统配置页面中进行设置
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* API 文档 */}
            <TabsContent value="api" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    API 文档
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">获取评论</h3>
                    <div className="bg-muted p-4 rounded-md mb-2">
                      <pre className="text-sm">
                        GET /api/comments?siteId=[siteId]&pageId=[pageId]
                      </pre>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      获取指定站点和页面的所有评论
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">创建评论</h3>
                    <div className="bg-muted p-4 rounded-md mb-2">
                      <pre className="text-sm">
{`POST /api/comments
Content-Type: application/json

{
  "siteId": "site_id",
  "pageId": "/posts/hello-world",
  "author": "用户名",
  "content": "评论内容",
  "email": "user@example.com", // 可选
  "website": "https://example.com", // 可选
  "parentId": "parent_comment_id" // 可选，用于回复
}`}
                      </pre>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      创建新评论或回复现有评论
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">获取站点信息</h3>
                    <div className="bg-muted p-4 rounded-md mb-2">
                      <pre className="text-sm">
                        GET /api/sites?host=[hostname]
                      </pre>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      根据域名获取站点信息
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}