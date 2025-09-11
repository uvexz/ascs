'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Cookies from 'js-cookie'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface CommentFormProps {
  siteId: string
  pageId: string
  parentId?: string
  onCommentAdded: () => void
  onCancel?: () => void
}

export function CommentForm({ 
  siteId, 
  pageId, 
  parentId, 
  onCommentAdded, 
  onCancel 
}: CommentFormProps) {
  const [author, setAuthor] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [submitMessageType, setSubmitMessageType] = useState<'success' | 'error' | 'warning'>('success')

  // 从 cookies 加载用户信息
  useEffect(() => {
    const savedAuthor = Cookies.get('ascs-author')
    const savedEmail = Cookies.get('ascs-email')
    const savedWebsite = Cookies.get('ascs-website')

    if (savedAuthor) setAuthor(savedAuthor)
    if (savedEmail) setEmail(savedEmail)
    if (savedWebsite) setWebsite(savedWebsite)
  }, [])

  // 保存用户信息到 cookies
  const saveUserInfo = () => {
    if (author.trim()) {
      Cookies.set('ascs-author', author.trim(), { expires: 365 })
    }
    if (email.trim()) {
      Cookies.set('ascs-email', email.trim(), { expires: 365 })
    }
    if (website.trim()) {
      Cookies.set('ascs-website', website.trim(), { expires: 365 })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!author.trim() || !content.trim()) {
      alert('请填写姓名和评论内容')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId,
          pageId,
          author: author.trim(),
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          content: content.trim(),
          parentId,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        saveUserInfo() // 保存用户信息到 cookies
        setContent('') // 只清空评论内容，保留用户信息
        
        // 根据返回的消息类型显示不同的提示
        if (result.message && result.message.includes('需要管理员审核')) {
          setSubmitMessage(result.message)
          setSubmitMessageType('warning')
        } else {
          onCommentAdded()
          if (onCancel) onCancel()
        }
      } else {
        const error = await response.json()
        setSubmitMessage(error.error || '提交失败，请重试')
        setSubmitMessageType('error')
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
      alert('提交失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">
          {parentId ? '回复评论' : '发表评论'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {submitMessage && (
          <Alert className={`mb-4 ${submitMessageType === 'error' ? 'border-red-200 bg-red-50' : submitMessageType === 'warning' ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}`}>
            <AlertDescription>
              {submitMessage}
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="姓名 *"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="url"
              placeholder="网站"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <Tabs value={mode} onValueChange={(value) => setMode(value as 'edit' | 'preview')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">编辑</TabsTrigger>
              <TabsTrigger value="preview">预览</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-2">
              <Textarea
                placeholder="写下你的评论..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
                className="resize-none"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                支持 Markdown 格式：
                <Badge variant="secondary" className='text-xs font-normal text-muted-foreground me-1'>**粗体**</Badge>
                <Badge variant="secondary" className='text-xs font-normal text-muted-foreground me-1'>*斜体*</Badge>
                <Badge variant="secondary" className='text-xs font-normal text-muted-foreground me-1'>`代码`</Badge>
                <Badge variant="secondary" className='text-xs font-normal text-muted-foreground me-1'>[链接](url)</Badge>
                <Badge variant="secondary" className='text-xs font-normal text-muted-foreground me-1'>&gt; 引用</Badge>
              </div>
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[150px] p-4 border rounded-md bg-muted/50">
                {content ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-center py-8">
                    在编辑标签页输入内容，然后切换到预览查看效果
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '提交评论'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}