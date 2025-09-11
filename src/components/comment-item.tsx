'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { CommentForm } from './comment-form'
import { generateAvatarUrl } from '@/lib/avatar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

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

interface CommentItemProps {
  comment: Comment
  siteId: string
  pageId: string
  onCommentAdded: () => void
  level?: number
}

export function CommentItem({ 
  comment, 
  siteId, 
  pageId, 
  onCommentAdded, 
  level = 0 
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  const handleReplyAdded = () => {
    setShowReplyForm(false)
    onCommentAdded()
  }

  return (
    <div className={`${level > 0 ? 'ml-6 mt-4 pl-4 border-l-2 border-muted' : ''}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage 
            src={generateAvatarUrl(comment.email, comment.author)} 
            alt={comment.author}
          />
          <AvatarFallback className="text-sm">
            {getInitials(comment.author)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {comment.website ? (
              <a
                href={comment.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground hover:underline"
              >
                {comment.author}
              </a>
            ) : (
              <span className="font-medium text-foreground">
                {comment.author}
              </span>
            )}
            <span>•</span>
            <time>{formatDate(comment.createdAt)}</time>
            {comment.status === 'PENDING' && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                待审核
              </span>
            )}
          </div>
          
          <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {comment.content}
            </ReactMarkdown>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              回复
            </Button>
          </div>
          
          {showReplyForm && (
            <div className="mt-4">
              <CommentForm
                siteId={siteId}
                pageId={pageId}
                parentId={comment.id}
                onCommentAdded={handleReplyAdded}
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  siteId={siteId}
                  pageId={pageId}
                  onCommentAdded={onCommentAdded}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}