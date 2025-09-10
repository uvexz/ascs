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
import { Trash2, Globe, MessageSquare, Settings, LogOut, Mail, Send } from 'lucide-react'
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
  site: {
    hostname: string
  }
}

export default function AdminPage() {
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSite, setShowAddSite] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState('')
  const [configSuccess, setConfigSuccess] = useState('')
  const router = useRouter()
  
  // 新站点表单
  const [newSite, setNewSite] = useState({
    hostname: '',
    name: '',
    description: ''
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
    await Promise.all([fetchSites(), fetchComments()])
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

  const handleConfigSave = async () => {
    try {
      setConfigLoading(true)
      setConfigError('')
      setConfigSuccess('')

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        setConfigSuccess('配置保存成功！')
        setTimeout(() => setConfigSuccess(''), 3000)
      } else {
        const data = await response.json()
        setConfigError(data.error || '保存失败')
      }
    } catch (error) {
      setConfigError('保存失败，请重试')
    } finally {
      setConfigLoading(false)
    }
  }

  const handleShowConfig = () => {
    setShowConfig(true)
    fetchConfig()
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
        setNewSite({ hostname: '', name: '', description: '' })
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
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('删除失败')
    }
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
                      </div>
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

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowConfig(false)}>
                    取消
                  </Button>
                  <Button onClick={handleConfigSave} disabled={configLoading}>
                    {configLoading ? '保存中...' : '保存配置'}
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