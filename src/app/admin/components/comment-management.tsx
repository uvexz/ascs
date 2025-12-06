'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MessageSquare, Trash2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { Comment, PaginationInfo } from './types'

interface CommentManagementProps {
  comments: Comment[]
  pendingComments: Comment[]
  pagination?: PaginationInfo
  pendingPagination?: PaginationInfo
  onCommentDeleted: () => void
  onCommentApproved: () => void
  onPageChange?: (offset: number) => void
  onPendingPageChange?: (offset: number) => void
}

export function CommentManagement({
  comments,
  pendingComments,
  pagination,
  pendingPagination,
  onCommentDeleted,
  onCommentApproved,
  onPageChange,
  onPendingPageChange,
}: CommentManagementProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('确定要删除这条评论吗？')) return

    setDeletingId(commentId)
    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onCommentDeleted()
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleApproveComment = async (commentId: string) => {
    setApprovingId(commentId)
    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (response.ok) {
        onCommentApproved()
      } else {
        alert('审核通过失败')
      }
    } catch (error) {
      console.error('Error approving comment:', error)
      alert('审核通过失败')
    } finally {
      setApprovingId(null)
    }
  }

  const renderPagination = (
    paginationInfo: PaginationInfo | undefined,
    onPageChangeHandler?: (offset: number) => void
  ) => {
    if (!paginationInfo || !onPageChangeHandler) return null

    const { total, limit, offset } = paginationInfo
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(total / limit)

    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          共 {total} 条，第 {currentPage} / {totalPages} 页
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => onPageChangeHandler(Math.max(0, offset - limit))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => onPageChangeHandler(offset + limit)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 待审核评论管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            待审核评论 ({pendingPagination?.total ?? pendingComments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">没有待审核的评论</div>
          ) : (
            <>
              <div className="space-y-4">
                {pendingComments.map((comment, index) => (
                  <div key={comment.id}>
                    <div className="flex items-start justify-between p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">{comment.author}</span>
                          <span>•</span>
                          <span>{comment.site.hostname}</span>
                          <span>•</span>
                          <span>{comment.pageId}</span>
                          <span>•</span>
                          <span>{formatDate(comment.createdAt)}</span>
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            待审核
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{comment.content}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveComment(comment.id)}
                          disabled={approvingId === comment.id}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {approvingId === comment.id ? '处理中...' : '通过'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={deletingId === comment.id}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {index < pendingComments.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
              {renderPagination(pendingPagination, onPendingPageChange)}
            </>
          )}
        </CardContent>
      </Card>

      {/* 评论管理 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            最近评论 ({pagination?.total ?? comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">还没有评论</div>
          ) : (
            <>
              <div className="space-y-4">
                {comments.map((comment, index) => (
                  <div key={comment.id}>
                    <div className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span className="font-medium text-foreground">{comment.author}</span>
                          <span>•</span>
                          <span>{comment.site.hostname}</span>
                          <span>•</span>
                          <span>{comment.pageId}</span>
                          <span>•</span>
                          <span>{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{comment.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingId === comment.id}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {index < comments.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}
              </div>
              {renderPagination(pagination, onPageChange)}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
