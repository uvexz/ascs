'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Globe, Code, Edit, Trash2 } from 'lucide-react'
import { Site } from './types'

interface SiteManagementProps {
  sites: Site[]
  onSiteAdded: () => void
  onSiteUpdated: () => void
  onSiteDeleted: () => void
  onShowEmbed: (site: Site) => void
}

export function SiteManagement({
  sites,
  onSiteAdded,
  onSiteUpdated,
  onSiteDeleted,
  onShowEmbed,
}: SiteManagementProps) {
  const [showAddSite, setShowAddSite] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [newSite, setNewSite] = useState({
    hostname: '',
    name: '',
    description: '',
    alternateHostnames: '',
  })
  const [editSiteForm, setEditSiteForm] = useState({
    hostname: '',
    name: '',
    description: '',
    alternateHostnames: '',
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSite),
      })

      if (response.ok) {
        setNewSite({ hostname: '', name: '', description: '', alternateHostnames: '' })
        setShowAddSite(false)
        onSiteAdded()
      } else {
        const error = await response.json()
        alert(error.error || '添加失败')
      }
    } catch (error) {
      console.error('Error adding site:', error)
      alert('添加失败')
    }
  }

  const handleEditSite = (site: Site) => {
    setEditingSite(site)
    setEditSiteForm({
      hostname: site.hostname,
      name: site.name || '',
      description: site.description || '',
      alternateHostnames: site.alternateHostnames || '',
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSiteForm),
      })

      if (response.ok) {
        setEditingSite(null)
        setEditSiteForm({ hostname: '', name: '', description: '', alternateHostnames: '' })
        onSiteUpdated()
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
    const confirmMessage =
      site._count.comments > 0
        ? `确定要删除站点 "${site.name || site.hostname}" 吗？这将同时删除 ${site._count.comments} 条评论，此操作不可恢复！`
        : `确定要删除站点 "${site.name || site.hostname}" 吗？`

    if (!confirm(confirmMessage)) return

    try {
      const response = await fetch(`/api/admin/sites/${site.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()
        alert(
          `站点删除成功${result.deletedComments > 0 ? `，同时删除了 ${result.deletedComments} 条评论` : ''}`
        )
        onSiteDeleted()
      } else {
        const error = await response.json()
        alert(error.error || '删除失败')
      }
    } catch (error) {
      console.error('Error deleting site:', error)
      alert('删除失败')
    }
  }

  return (
    <>
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
                      {site.description && <p className="text-sm mt-1">{site.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>创建时间: {formatDate(site.createdAt)}</span>
                        <span>评论数: {site._count.comments}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onShowEmbed(site)}>
                        <Code className="h-4 w-4 mr-1" />
                        集成代码
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditSite(site)}>
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
                    onChange={(e) =>
                      setEditSiteForm({ ...editSiteForm, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-alternate-hostnames">备用域名</Label>
                  <Input
                    id="edit-alternate-hostnames"
                    placeholder="alt1.com,alt2.com (多个域名用逗号分隔)"
                    value={editSiteForm.alternateHostnames}
                    onChange={(e) =>
                      setEditSiteForm({ ...editSiteForm, alternateHostnames: e.target.value })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    多个域名请用逗号分隔，这些域名将可以访问此站点的评论系统
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingSite(null)}>
                    取消
                  </Button>
                  <Button type="submit">保存更改</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
