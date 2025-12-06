'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings, LogOut } from 'lucide-react'
import { Navigation } from '@/components/navigation'
import {
  Site,
  Comment,
  PaginationInfo,
  SiteManagement,
  CommentManagement,
  ConfigModal,
  EmbedModal,
} from './components'

const COMMENTS_PER_PAGE = 20

export default function AdminPage() {
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [pendingComments, setPendingComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [showEmbedSite, setShowEmbedSite] = useState<Site | null>(null)
  
  // 分页状态
  const [commentsPagination, setCommentsPagination] = useState<PaginationInfo>({
    total: 0,
    limit: COMMENTS_PER_PAGE,
    offset: 0,
    hasMore: false,
  })
  const [pendingPagination, setPendingPagination] = useState<PaginationInfo>({
    total: 0,
    limit: COMMENTS_PER_PAGE,
    offset: 0,
    hasMore: false,
  })

  const router = useRouter()

  const fetchSites = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sites')
      if (response.ok) {
        const data = await response.json()
        setSites(data)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    }
  }, [])

  const fetchComments = useCallback(async (offset = 0) => {
    try {
      const response = await fetch(
        `/api/admin/comments?limit=${COMMENTS_PER_PAGE}&offset=${offset}`
      )
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments)
        setCommentsPagination({
          total: data.total,
          limit: data.limit,
          offset: data.offset,
          hasMore: data.offset + data.limit < data.total,
        })
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }, [])

  const fetchPendingComments = useCallback(async (offset = 0) => {
    try {
      const response = await fetch(
        `/api/admin/comments?status=PENDING&limit=${COMMENTS_PER_PAGE}&offset=${offset}`
      )
      if (response.ok) {
        const data = await response.json()
        setPendingComments(data.comments)
        setPendingPagination({
          total: data.total,
          limit: data.limit,
          offset: data.offset,
          hasMore: data.offset + data.limit < data.total,
        })
      }
    } catch (error) {
      console.error('Error fetching pending comments:', error)
    }
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        return true
      } else {
        router.push('/admin/login')
        return false
      }
    } catch {
      router.push('/admin/login')
      return false
    }
  }, [router])

  const loadData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchSites(), fetchComments(), fetchPendingComments()])
    setLoading(false)
  }, [fetchSites, fetchComments, fetchPendingComments])

  useEffect(() => {
    const init = async () => {
      const isAuthed = await checkAuth()
      if (isAuthed) {
        await loadData()
      }
    }
    init()
  }, [checkAuth, loadData])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleCommentsPageChange = (offset: number) => {
    fetchComments(offset)
  }

  const handlePendingPageChange = (offset: number) => {
    fetchPendingComments(offset)
  }

  const handleCommentChange = () => {
    fetchComments(commentsPagination.offset)
    fetchPendingComments(pendingPagination.offset)
  }

  const handleSiteChange = () => {
    fetchSites()
    fetchComments(0)
  }

  if (!user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">ASCS 管理后台</h1>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">ASCS 管理后台</h1>
            <p className="text-muted-foreground">
              欢迎回来，{user.username}！管理你的评论系统站点和评论
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowConfig(true)}>
              <Settings className="h-4 w-4 mr-2" />
              系统配置
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>

        <div className="grid gap-8">
          <SiteManagement
            sites={sites}
            onSiteAdded={handleSiteChange}
            onSiteUpdated={handleSiteChange}
            onSiteDeleted={handleSiteChange}
            onShowEmbed={setShowEmbedSite}
          />

          <CommentManagement
            comments={comments}
            pendingComments={pendingComments}
            pagination={commentsPagination}
            pendingPagination={pendingPagination}
            onCommentDeleted={handleCommentChange}
            onCommentApproved={handleCommentChange}
            onPageChange={handleCommentsPageChange}
            onPendingPageChange={handlePendingPageChange}
          />
        </div>

        <ConfigModal isOpen={showConfig} onClose={() => setShowConfig(false)} />
        <EmbedModal site={showEmbedSite} onClose={() => setShowEmbedSite(null)} />
      </div>
    </div>
  )
}
