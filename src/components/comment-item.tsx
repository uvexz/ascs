'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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



  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return '几秒钟前'
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes}分钟前`
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours}小时前`
    }
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) {
      return `${diffInDays}天前`
    }
    
    const diffInMonths = Math.floor(diffInDays / 30)
    if (diffInMonths < 12) {
      return `${diffInMonths}月前`
    }
    
    const diffInYears = Math.floor(diffInMonths / 12)
    return `${diffInYears}年前`
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
            <Badge variant="outline" className="text-xs text-muted-foreground font-medium">
              <time>{getRelativeTime(comment.createdAt)}</time>
            </Badge>
            {comment.status === 'PENDING' && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                待审核
              </span>
            )}
          </div>
          
          <div className="text-sm leading-relaxed prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // 自定义组件渲染
                p: ({ children }) => <p className="my-2">{children}</p>,
                h1: ({ children }) => <h1 className="text-lg font-semibold my-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-semibold my-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold my-2">{children}</h3>,
                code: ({ inline, children, ...props }) => {
                  if (inline) {
                    return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                  }
                  return <code {...props}>{children}</code>
                },
                pre: ({ children }) => (
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto my-2 text-xs">
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-border pl-4 my-2 text-muted-foreground italic">
                    {children}
                  </blockquote>
                ),
                ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                a: ({ href, children }) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {children}
                  </a>
                ),
              }}
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