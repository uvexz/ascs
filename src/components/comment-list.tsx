'use client'

import { CommentItem } from './comment-item'
import { Separator } from '@/components/ui/separator'

interface Comment {
  id: string
  content: string
  author: string
  email?: string
  website?: string
  createdAt: string
  status?: 'APPROVED' | 'PENDING' | 'REJECTED'
  replies?: Comment[]
}

interface CommentListProps {
  comments: Comment[]
  siteId: string
  pageId: string
  onCommentAdded: () => void
}

export function CommentList({ comments, siteId, pageId, onCommentAdded }: CommentListProps) {
  // 只显示已批准的评论
  const approvedComments = comments.filter(comment => comment.status === 'APPROVED' || comment.status === undefined)
  
  if (approvedComments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        还没有评论，来发表第一条评论吧！
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {approvedComments.map((comment, index) => (
        <div key={comment.id}>
          <CommentItem
            comment={comment}
            siteId={siteId}
            pageId={pageId}
            onCommentAdded={onCommentAdded}
          />
          {index < approvedComments.length - 1 && <Separator className="mt-6" />}
        </div>
      ))}
    </div>
  )
}