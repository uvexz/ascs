'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/navigation'
import { CommentBox } from '@/components/comment-box'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Code, ExternalLink, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { getCurrentHost } from '@/lib/utils'

export default function DemoPage() {
    const [siteId, setSiteId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentHost, setCurrentHost] = useState('your-domain.com')

    useEffect(() => {
        setCurrentHost(getCurrentHost())
        
        // 获取站点信息
        const fetchSite = async () => {
            try {
                const hostname = window.location.hostname
                const response = await fetch(`/api/sites?host=${encodeURIComponent(hostname)}`)

                if (response.ok) {
                    const site = await response.json()
                    setSiteId(site.id)
                } else {
                    console.error('Failed to fetch site')
                }
            } catch (error) {
                console.error('Error fetching site:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchSite()
    }, [])

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <div className="container mx-auto py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold mb-4">在线示例</h1>
                        <p className="text-lg text-muted-foreground">
                            体验 ASCS 评论系统的完整功能，包括评论、回复、通知等
                        </p>
                    </div>

                    {/* 示例文章 */}
                    <Card className="mb-8">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-2xl mb-2">欢迎使用 ASCS 评论系统</CardTitle>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>发布时间: 2024年1月1日</span>
                                        <span>•</span>
                                        <span>作者: ASCS Team</span>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href="/example.html" target="_blank">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        静态示例
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p>
                                ASCS (A Simple Comment System) 是一个基于 Next.js 和 shadcn/ui 构建的现代化评论系统。
                                它具有以下特点：
                            </p>

                            <ul className="list-disc list-inside space-y-1 text-sm">
                                <li>🎨 现代化的 UI 设计</li>
                                <li>🔧 易于集成，只需一个脚本标签</li>
                                <li>💬 支持多层级回复</li>
                                <li>📱 完美的响应式设计</li>
                                <li>🚀 快速部署到各种平台</li>
                                <li>📧 邮件和 Telegram 通知</li>
                                <li>🛡️ 安全的管理后台</li>
                                <li>🌐 多站点支持</li>
                            </ul>

                            <p>
                                要在你的网站中集成 ASCS，只需要在页面中添加一个容器元素和一个脚本标签即可。
                                系统会自动根据当前页面的域名和路径来管理评论。
                            </p>

                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">Next.js 15</Badge>
                                <Badge variant="secondary">TypeScript</Badge>
                                <Badge variant="secondary">shadcn/ui</Badge>
                                <Badge variant="secondary">Tailwind CSS</Badge>
                                <Badge variant="secondary">Prisma</Badge>
                                <Badge variant="secondary">PostgreSQL</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 集成代码示例 */}
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Code className="h-5 w-5" />
                                集成代码示例
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="bg-muted p-4 rounded-md">
                                <code className="text-sm">
                                    {'<!-- 评论容器 -->'}<br />
                                    {'<div id="comments"></div>'}<br /><br />
                                    {'<!-- 加载评论系统 -->'}<br />
                                    {'<script'}<br />
                                    {'  src="https://your-domain.com/comments.js"'}<br />
                                    {'  data-page-id="/demo/welcome"'}<br />
                                    {'  data-ascs-host="https://your-domain.com"'}<br />
                                    {'  defer>'}<br />
                                    {'</script>'}
                                </code>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 实际评论区域 */}

                            {loading ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">加载评论系统中...</p>
                                </div>
                            ) : !siteId ? (
                                <div className="text-center py-8">
                                    <p className="text-red-500">无法加载站点信息</p>
                                </div>
                            ) : (
                                <CommentBox siteId={siteId} pageId="/demo/welcome" />
                            )}

                    {/* 功能说明 */}
                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                            你可以在上方的评论区域中尝试发表评论和回复，体验完整的功能
                        </p>
                        <div className="flex justify-center gap-4">
                            <Button variant="outline" asChild>
                                <Link href="/docs">
                                    查看文档
                                </Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href="/admin">
                                    管理后台
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}