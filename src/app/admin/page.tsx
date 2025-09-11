'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, Globe, MessageSquare, Settings, LogOut, Mail, Send, Edit, Code, Copy, Check, Bot, CheckCircle } from 'lucide-react'
import { Navigation } from '@/components/navigation'

interface Site {
  id: string
  hostname: string
  name?: string
  description?: string
  createdAt: string
  _count: {
    comments: number
  }
}

interface Comment {
  id: string
  content: string
  author: string
  pageId: string
  createdAt: string
  status: 'APPROVED' | 'PENDING' | 'REJECTED'
  site: {
    hostname: string
  }
}

interface AIConfig {
  id: string
  baseUrl: string
  model: string
  apiKey: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export default function AdminPage() {
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [pendingComments, setPendingComments] = useState<Comment[]>([])
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddSite, setShowAddSite] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState('')
  const [configSuccess, setConfigSuccess] = useState('')
  const [aiConfigLoading, setAiConfigLoading] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [showEmbedDetails, setShowEmbedDetails] = useState<Site | null>(null)
  const [copiedCode, setCopiedCode] = useState('')
  const router = useRouter()
  
  // 新站点表单
  const [newSite, setNewSite] = useState({
    hostname: '',
    name: '',
    description: '',
    alternateHostnames: ''
  })

  // 编辑站点表单
  const [editSiteForm, setEditSiteForm] = useState({
    hostname: '',
    name: '',
    description: '',
    alternateHostnames: ''
  })

  const fetchSites = async () => {
    try {
      const response = await fetch('/api/admin/sites')
      if (response.ok) {
        const data = await response.json()
        setSites(data)
      }
    } catch (error) {
      console.error('Error fetching sites:', error)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await fetch('/api/admin/comments?limit=20')
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const fetchPendingComments = async () => {
    try {
      const response = await fetch('/api/admin/comments?status=PENDING&limit=20')
      if (response.ok) {
        const data = await response.json()
        setPendingComments(data.comments)
      }
    } catch (error) {
      console.error('Error fetching pending comments:', error)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        loadData()
      } else {
        router.push('/admin/login')
      }
    } catch (error) {
      router.push('/admin/login')
    }
  }

  const loadData = async () => {
    setLoading(true)
    await Promise.all([fetchSites(), fetchComments(), fetchPendingComments()])
    setLoading(false)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const fetchConfig = async () => {
    try {
      setConfigLoading(true)
      const response = await fetch('/api/admin/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setConfigLoading(false)
    }
  }

  const fetchAIConfig = async () => {
    try {
      setAiConfigLoading(true)
      const response = await fetch('/api/admin/ai-config')
      if (response.ok) {
        const data = await response.json()
        setAiConfig(data)
      }
    } catch (error) {
      console.error('Error fetching AI config:', error)
    } finally {
      setAiConfigLoading(false)
    }
  }

  const handleSaveAllConfigs = async () => {
    try {
      setConfigLoading(true)
      setAiConfigLoading(true)
      setConfigError('')
      setConfigSuccess('')

      // 验证 AI 配置
      if (aiConfig?.isEnabled && (!aiConfig.baseUrl || !aiConfig.model || !aiConfig.apiKey)) {
        setConfigError('启用 AI 反垃圾评论功能时，请填写所有 AI 配置字段')
        return
      }

      // 保存普通配置
      const configResponse = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!configResponse.ok) {
        const data = await configResponse.json()
        setConfigError(data.error || '配置保存失败')
        return
      }

      // 如果有 AI 配置，保存 AI 配置
      if (aiConfig) {
        const aiResponse = await fetch('/api/admin/ai-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            baseUrl: aiConfig.baseUrl,
            model: aiConfig.model,
            apiKey: aiConfig.apiKey,
            isEnabled: aiConfig.isEnabled,
          }),
        })

        if (aiResponse.ok) {
          const savedAIConfig = await aiResponse.json()
          setAiConfig(savedAIConfig)
        } else {
          const data = await aiResponse.json()
          setConfigError(data.error || 'AI 配置保存失败')
          return
        }
      }

      setConfigSuccess('所有配置保存成功！')
      setTimeout(() => setConfigSuccess(''), 3000)
    } catch (error) {
      setConfigError('保存失败，请重试')
    } finally {
      setConfigLoading(false)
      setAiConfigLoading(false)
    }
  }

  const handleShowConfig = () => {
    setShowConfig(true)
    fetchConfig()
    fetchAIConfig()
  }

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newSite.hostname.trim()) {
      alert('请输入域名')
      return
    }

    try {
      const response = await fetch('/api/admin/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSite),
      })

      if (response.ok) {
        setNewSite({ hostname: '', name: '', description: '', alternateHostnames: '' })
        setShowAddSite(false)
        fetchSites()
      } else {
        const error = await response.json()
        alert(error.error || '添加失败')
      }
    } catch (error) {
      console.error('Error adding site:', error)
      alert('添加失败')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('确定要删除这条评论吗？')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchComments()
        fetchPendingComments() // 刷新待审核评论列表
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('删除失败')
    }
  }

  const handleApproveComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/admin/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (response.ok) {
        fetchComments()
        fetchPendingComments() // 刷新待审核评论列表
      } else {
        alert('审核通过失败')
      }
    } catch (error) {
      console.error('Error approving comment:', error)
      alert('审核通过失败')
    }
  }

  const handleEditSite = (site: Site) => {
    setEditingSite(site)
    setEditSiteForm({
      hostname: site.hostname,
      name: site.name || '',
      description: site.description || '',
      alternateHostnames: (site as any).alternateHostnames || ''
    })
  }

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingSite || !editSiteForm.hostname.trim()) {
      alert('请输入域名')
      return
    }

    try {
      const response = await fetch(`/api/admin/sites/${editingSite.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editSiteForm),
      })

      if (response.ok) {
        setEditingSite(null)
        setEditSiteForm({ hostname: '', name: '', description: '', alternateHostnames: '' })
        fetchSites()
      } else {
        const error = await response.json()
        alert(error.error || '更新失败')
      }
    } catch (error) {
      console.error('Error updating site:', error)
      alert('更新失败')
    }
  }

  const handleDeleteSite = async (site: Site) => {
    const confirmMessage = site._count.comments > 0 
      ? `确定要删除站点 "${site.name || site.hostname}" 吗？这将同时删除 ${site._count.comments} 条评论，此操作不可恢复！`
      : `确定要删除站点 "${site.name || site.hostname}" 吗？`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/sites/${site.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        alert(`站点删除成功${result.deletedComments > 0 ? `，同时删除了 ${result.deletedComments} 条评论` : ''}`)
        fetchSites()
        fetchComments() // 刷新评论列表
      } else {
        const error = await response.json()
        alert(error.error || '删除失败')
      }
    } catch (error) {
      console.error('Error deleting site:', error)
      alert('删除失败')
    }
  }

  const handleShowEmbedDetails = (site: Site) => {
    setShowEmbedDetails(site)
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(type)
      setTimeout(() => setCopiedCode(''), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('复制失败，请手动复制')
    }
  }

  const getCurrentHost = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return 'https://your-domain.com'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
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
            <Button variant="outline" onClick={handleShowConfig}>
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
          {/* 站点管理 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  站点管理 ({sites.length})
                </CardTitle>
                <Button onClick={() => setShowAddSite(!showAddSite)}>
                  {showAddSite ? '取消' : '添加站点'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showAddSite && (
                <form onSubmit={handleAddSite} className="mb-6 p-4 border rounded-lg">
                  <div className="grid gap-4">
                    <Input
                      placeholder="域名 (如: example.com) *"
                      value={newSite.hostname}
                      onChange={(e) => setNewSite({ ...newSite, hostname: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="站点名称"
                      value={newSite.name}
                      onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    />
                    <Textarea
                      placeholder="站点描述"
                      value={newSite.description}
                      onChange={(e) => setNewSite({ ...newSite, description: e.target.value })}
                      rows={3}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="alternate-hostnames">备用域名</Label>
                      <Input
                        id="alternate-hostnames"
                        placeholder="alt1.com,alt2.com (多个域名用逗号分隔)"
                        value={newSite.alternateHostnames}
                        onChange={(e) => setNewSite({ ...newSite, alternateHostnames: e.target.value })}
                      />
                      <p className="text-sm text-muted-foreground">
                        多个域名请用逗号分隔，这些域名将可以访问此站点的评论系统
                      </p>
                    </div>
                    <Button type="submit">添加站点</Button>
                  </div>
                </form>
              )}

              {sites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  还没有站点，点击上方按钮添加第一个站点
                </div>
              ) : (
                <div className="space-y-4">
                  {sites.map((site) => (
                    <div key={site.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{site.name || site.hostname}</h3>
                          <p className="text-sm text-muted-foreground">{site.hostname}</p>
                          {site.description && (
                            <p className="text-sm mt-1">{site.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>创建时间: {formatDate(site.createdAt)}</span>
                            <span>评论数: {site._count.comments}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowEmbedDetails(site)}
                          >
                            <Code className="h-4 w-4 mr-1" />
                            集成代码
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditSite(site)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSite(site)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 待审核评论管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                待审核评论 ({pendingComments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingComments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  没有待审核的评论
                </div>
              ) : (
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
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            通过
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
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
              )}
            </CardContent>
          </Card>

          {/* 评论管理 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                最近评论 ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  还没有评论
                </div>
              ) : (
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
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {index < comments.length - 1 && <Separator className="my-4" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
  
      {/* 编辑站点模态框 */}
        {editingSite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="h-5 w-5" />
                    编辑站点
                  </CardTitle>
                  <Button variant="ghost" onClick={() => setEditingSite(null)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateSite} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-hostname">域名 *</Label>
                    <Input
                      id="edit-hostname"
                      placeholder="example.com"
                      value={editSiteForm.hostname}
                      onChange={(e) => setEditSiteForm({ ...editSiteForm, hostname: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">站点名称</Label>
                    <Input
                      id="edit-name"
                      placeholder="我的网站"
                      value={editSiteForm.name}
                      onChange={(e) => setEditSiteForm({ ...editSiteForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">站点描述</Label>
                    <Textarea
                      id="edit-description"
                      placeholder="站点描述"
                      value={editSiteForm.description}
                      onChange={(e) => setEditSiteForm({ ...editSiteForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-alternate-hostnames">备用域名</Label>
                    <Input
                      id="edit-alternate-hostnames"
                      placeholder="alt1.com,alt2.com (多个域名用逗号分隔)"
                      value={editSiteForm.alternateHostnames}
                      onChange={(e) => setEditSiteForm({ ...editSiteForm, alternateHostnames: e.target.value })}
                    />
                    <p className="text-sm text-muted-foreground">
                      多个域名请用逗号分隔，这些域名将可以访问此站点的评论系统
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditingSite(null)}>
                      取消
                    </Button>
                    <Button type="submit">
                      保存更改
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Embed 详情模态框 */}
        {showEmbedDetails && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    集成代码 - {showEmbedDetails.name || showEmbedDetails.hostname}
                  </CardTitle>
                  <Button variant="ghost" onClick={() => setShowEmbedDetails(null)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">基本集成</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      在你的网页中添加以下代码即可集成评论系统：
                    </p>
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                        <code>{`<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统 -->
<script
  src="${getCurrentHost()}/comments.js"
  data-page-id="/your-page-path"
  defer>
</script>`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统 -->
<script
  src="${getCurrentHost()}/comments.js"
  data-page-id="/your-page-path"
  defer>
</script>`, 'basic')}
                      >
                        {copiedCode === 'basic' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">高级配置</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      你可以通过以下参数自定义评论系统：
                    </p>
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">
                        <code>{`<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统（高级配置） -->
<script
  src="${getCurrentHost()}/comments.js"
  data-page-id="/your-page-path"
  data-ascs-host="${getCurrentHost()}"
  data-container-id="comments"
  defer>
</script>`}</code>
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`<!-- 评论容器 -->
<div id="comments"></div>

<!-- 加载评论系统（高级配置） -->
<script
  src="${getCurrentHost()}/comments.js"
  data-page-id="/your-page-path"
  data-ascs-host="${getCurrentHost()}"
  data-container-id="comments"
  defer>
</script>`, 'advanced')}
                      >
                        {copiedCode === 'advanced' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">参数说明</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted rounded">
                        <div className="font-medium">data-page-id</div>
                        <div className="text-muted-foreground">可选</div>
                        <div>页面唯一标识符，用于区分不同页面的评论</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted rounded">
                        <div className="font-medium">data-ascs-host</div>
                        <div className="text-muted-foreground">可选</div>
                        <div>ASCS 服务器地址，默认自动检测</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted rounded">
                        <div className="font-medium">data-container-id</div>
                        <div className="text-muted-foreground">可选</div>
                        <div>评论容器的 ID，默认为 "comments"</div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">站点信息</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground">站点 ID</div>
                        <div className="font-mono bg-muted px-2 py-1 rounded">{showEmbedDetails.id}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">域名</div>
                        <div className="font-mono bg-muted px-2 py-1 rounded">{showEmbedDetails.hostname}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">评论数量</div>
                        <div className="font-mono bg-muted px-2 py-1 rounded">{showEmbedDetails._count.comments}</div>
                      </div>
                      <div>
                        <div className="font-medium text-muted-foreground">创建时间</div>
                        <div className="font-mono bg-muted px-2 py-1 rounded">{formatDate(showEmbedDetails.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 系统配置模态框 */}
        {showConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    系统配置
                  </CardTitle>
                  <Button variant="ghost" onClick={() => setShowConfig(false)}>
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {configError && (
                  <Alert variant="destructive">
                    <AlertDescription>{configError}</AlertDescription>
                  </Alert>
                )}
                
                {configSuccess && (
                  <Alert>
                    <AlertDescription>{configSuccess}</AlertDescription>
                  </Alert>
                )}

                {/* SMTP 配置 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <h3 className="text-lg font-semibold">邮件通知配置</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_host">SMTP 服务器</Label>
                      <Input
                        id="smtp_host"
                        placeholder="smtp.gmail.com"
                        value={config.smtp_host || ''}
                        onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_port">SMTP 端口</Label>
                      <Input
                        id="smtp_port"
                        placeholder="587"
                        value={config.smtp_port || ''}
                        onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_user">SMTP 用户名</Label>
                      <Input
                        id="smtp_user"
                        placeholder="your-email@gmail.com"
                        value={config.smtp_user || ''}
                        onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp_pass">SMTP 密码</Label>
                      <Input
                        id="smtp_pass"
                        type="password"
                        placeholder="应用专用密码"
                        value={config.smtp_pass || ''}
                        onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_from">发件人地址</Label>
                    <Input
                      id="smtp_from"
                      placeholder="ASCS <noreply@yourdomain.com>"
                      value={config.smtp_from || ''}
                      onChange={(e) => setConfig({ ...config, smtp_from: e.target.value })}
                    />
                  </div>
                </div>

                <Separator />

                {/* Telegram 配置 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    <h3 className="text-lg font-semibold">Telegram 通知配置</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telegram_bot_token">Bot Token</Label>
                      <Input
                        id="telegram_bot_token"
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        value={config.telegram_bot_token || ''}
                        onChange={(e) => setConfig({ ...config, telegram_bot_token: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telegram_chat_id">Chat ID</Label>
                      <Input
                        id="telegram_chat_id"
                        placeholder="-1001234567890"
                        value={config.telegram_chat_id || ''}
                        onChange={(e) => setConfig({ ...config, telegram_chat_id: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>如何获取 Telegram 配置：</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>与 @BotFather 对话创建机器人，获取 Bot Token</li>
                      <li>将机器人添加到群组或频道</li>
                      <li>发送消息后访问 https://api.telegram.org/bot{'{TOKEN}'}/getUpdates 获取 Chat ID</li>
                    </ol>
                  </div>
                </div>

                <Separator />

                {/* AI 配置 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <h3 className="text-lg font-semibold">AI 反垃圾评论配置</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="ai_enabled"
                        checked={aiConfig?.isEnabled ?? false}
                        onChange={(e) => setAiConfig(aiConfig ? { ...aiConfig, isEnabled: e.target.checked } : {
                          id: '',
                          baseUrl: '',
                          model: '',
                          apiKey: '',
                          isEnabled: e.target.checked,
                          createdAt: '',
                          updatedAt: ''
                        })}
                        className="rounded"
                      />
                      <Label htmlFor="ai_enabled">启用 AI 反垃圾评论功能</Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ai_base_url">API 基础 URL</Label>
                      <Input
                        id="ai_base_url"
                        placeholder="https://api.openai.com/v1"
                        value={aiConfig?.baseUrl || ''}
                        onChange={(e) => setAiConfig(aiConfig ? { ...aiConfig, baseUrl: e.target.value } : {
                          id: '',
                          baseUrl: e.target.value,
                          model: '',
                          apiKey: '',
                          isEnabled: false,
                          createdAt: '',
                          updatedAt: ''
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ai_model">模型名称</Label>
                      <Input
                        id="ai_model"
                        placeholder="gpt-3.5-turbo"
                        value={aiConfig?.model || ''}
                        onChange={(e) => setAiConfig(aiConfig ? { ...aiConfig, model: e.target.value } : {
                          id: '',
                          baseUrl: '',
                          model: e.target.value,
                          apiKey: '',
                          isEnabled: false,
                          createdAt: '',
                          updatedAt: ''
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ai_api_key">API 密钥</Label>
                      <Input
                        id="ai_api_key"
                        type="password"
                        placeholder="sk-..."
                        value={aiConfig?.apiKey || ''}
                        onChange={(e) => setAiConfig(aiConfig ? { ...aiConfig, apiKey: e.target.value } : {
                          id: '',
                          baseUrl: '',
                          model: '',
                          apiKey: e.target.value,
                          isEnabled: false,
                          createdAt: '',
                          updatedAt: ''
                        })}
                      />
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>AI 反垃圾评论功能说明：</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>支持 OpenAI 兼容的 API 接口</li>
                      <li>确认为垃圾信息的评论将被直接删除</li>
                      <li>疑似垃圾信息的评论将标记为待审核，并发送通知给管理员</li>
                      <li>正常评论将直接放行</li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowConfig(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSaveAllConfigs} disabled={configLoading || aiConfigLoading}>
                    {configLoading || aiConfigLoading ? '保存中...' : '保存所有配置'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}