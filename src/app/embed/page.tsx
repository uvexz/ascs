'use client'

import { useEffect, useState, useRef, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
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
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const rafRef = useRef<number | null>(null)

    // 使用 RAF 节流的高度更新
    const sendHeightToParent = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
        }

        rafRef.current = requestAnimationFrame(() => {
            if (containerRef.current && window.parent !== window) {
                const height = containerRef.current.scrollHeight
                window.parent.postMessage({
                    type: 'ascs-resize',
                    height: height + 20
                }, '*')
            }
        })
    }, [])

    // 加载评论
    const loadComments = useCallback(async () => {
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
    }, [siteId, pageId])

    // 评论添加后的回调
    const handleCommentAdded = useCallback(() => {
        loadComments()
    }, [loadComments])

    // 初始加载评论
    useEffect(() => {
        loadComments()
    }, [loadComments])

    // 设置 ResizeObserver（只创建一次）
    useEffect(() => {
        if (!containerRef.current) return

        resizeObserverRef.current = new ResizeObserver(() => {
            sendHeightToParent()
        })

        resizeObserverRef.current.observe(containerRef.current)

        // 初始高度
        sendHeightToParent()

        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect()
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [sendHeightToParent])

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

            <div className="flex justify-center gap-4">
                <Button variant="link" asChild className="text-xs font-normal text-muted-foreground">
                    <Link href="https://github.com/uvexz/ascs" target='_blank'>
                        A SIMPLE COMMENT SYSTEM
                    </Link>
                </Button>
            </div>
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