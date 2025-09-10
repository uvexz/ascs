'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommentForm } from './comment-form'
import { CommentList } from './comment-list'
import { MessageSquare } from 'lucide-react'

interface Comment {
  id: string
  content: string
  author: string
  email?: string
  website?: string
  createdAt: string
  replies?: Comment[]
}

interface CommentBoxProps {
  siteId: string
  pageId: string
}

export function CommentBox({ siteId, pageId }: CommentBoxProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/comments?siteId=${encodeURIComponent(siteId)}&pageId=${encodeURIComponent(pageId)}`
      )
      
      if (response.ok) {
        const data = await response.json()
        setComments(data)
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || '加载评论失败')
      }
    } catch (err) {
      console.error('Error fetching comments:', err)
      setError('加载评论失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (siteId && pageId) {
      fetchComments()
    }
  }, [siteId, pageId])

  const handleCommentAdded = () => {
    fetchComments()
  }

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            加载评论中...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
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