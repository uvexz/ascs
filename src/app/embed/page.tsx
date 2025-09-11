'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommentForm } from '@/components/comment-form'
import { CommentList } from '@/components/comment-list'
import { MessageSquare } from 'lucide-react'

interface Comment {
    id: string
    author: string
    content: string
    email?: string
    website?: string
    createdAt: string
    replies?: Comment[]
}

function EmbedContent() {
    const searchParams = useSearchParams()
    const siteId = searchParams.get('siteId')
    const pageId = searchParams.get('pageId')
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // 发送高度变化消息给父窗口
    const sendHeightToParent = () => {
        if (containerRef.current && window.parent !== window) {
            const height = containerRef.current.scrollHeight
            window.parent.postMessage({
                type: 'ascs-resize',
                height: height + 20 // 添加一些边距
            }, '*')
        }
    }

    // 加载评论
    const loadComments = async () => {
        if (!siteId || !pageId) {
            setError('缺少必要参数')
            setLoading(false)
            return
        }

        try {
            const response = await fetch(`/api/comments?siteId=${encodeURIComponent(siteId)}&pageId=${encodeURIComponent(pageId)}`)
            if (!response.ok) {
                throw new Error('加载评论失败')
            }
            const data = await response.json()
            setComments(data)
            setError(null)
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载评论失败')
        } finally {
            setLoading(false)
        }
    }

    // 评论添加后的回调
    const handleCommentAdded = () => {
        loadComments()
    }

    useEffect(() => {
        loadComments()
    }, [siteId, pageId])

    // 监听内容变化，更新高度
    useEffect(() => {
        sendHeightToParent()

        // 使用 ResizeObserver 监听容器大小变化
        if (containerRef.current) {
            const resizeObserver = new ResizeObserver(() => {
                sendHeightToParent()
            })

            resizeObserver.observe(containerRef.current)

            return () => {
                resizeObserver.disconnect()
            }
        }
    }, [comments, loading, error])

    // 初始高度设置
    useEffect(() => {
        const timer = setTimeout(sendHeightToParent, 100)
        return () => clearTimeout(timer)
    }, [])

    if (!siteId || !pageId) {
        return (
            <div ref={containerRef}>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center text-red-500">
                            错误：缺少必要的参数 (siteId 或 pageId)
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (loading) {
        return (
            <div ref={containerRef}>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center text-muted-foreground">
                            加载评论中...
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (error) {
        return (
            <div ref={containerRef}>
                <Card>
                    <CardContent className="p-6">
                        <div className="text-center text-red-500">
                            加载失败: {error}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div ref={containerRef} className="w-full max-w-4xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        评论 ({comments.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CommentList
                        comments={comments}
                        siteId={siteId}
                        pageId={pageId}
                        onCommentAdded={handleCommentAdded}
                    />
                </CardContent>
            </Card>

            <CommentForm
                siteId={siteId}
                pageId={pageId}
                onCommentAdded={handleCommentAdded}
            />
        </div>
    )
}

export default function EmbedPage() {
    return (
        <Suspense fallback={
            <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">加载中...</p>
            </div>
        }>
            <EmbedContent />
        </Suspense>
    )
}