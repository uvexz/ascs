'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Cookies from 'js-cookie'

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
        saveUserInfo() // 保存用户信息到 cookies
        setContent('') // 只清空评论内容，保留用户信息
        onCommentAdded()
        if (onCancel) onCancel()
      } else {
        const error = await response.json()
        alert(error.error || '提交失败，请重试')
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
          <Textarea
            placeholder="写下你的评论... *"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            required
          />
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