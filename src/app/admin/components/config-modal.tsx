'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Settings, Mail, Send, Bot } from 'lucide-react'
import { AIConfig } from './types'

interface ConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ConfigModal({ isOpen, onClose }: ConfigModalProps) {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [aiConfigLoading, setAiConfigLoading] = useState(false)
  const [configError, setConfigError] = useState('')
  const [configSuccess, setConfigSuccess] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchConfig()
      fetchAIConfig()
    }
  }, [isOpen])

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
        headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
    } catch {
      setConfigError('保存失败，请重试')
    } finally {
      setConfigLoading(false)
      setAiConfigLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              系统配置
            </CardTitle>
            <Button variant="ghost" onClick={onClose}>
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
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">{configSuccess}</AlertDescription>
            </Alert>
          )}

          {/* SMTP 配置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Mail className="h-5 w-5" />
              邮件通知配置 (SMTP)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP 服务器</Label>
                <Input
                  id="smtp_host"
                  placeholder="smtp.example.com"
                  value={config.smtp_host || ''}
                  onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">端口</Label>
                <Input
                  id="smtp_port"
                  placeholder="587"
                  value={config.smtp_port || ''}
                  onChange={(e) => setConfig({ ...config, smtp_port: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">用户名</Label>
                <Input
                  id="smtp_user"
                  placeholder="user@example.com"
                  value={config.smtp_user || ''}
                  onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_pass">密码</Label>
                <Input
                  id="smtp_pass"
                  type="password"
                  placeholder="••••••••"
                  value={config.smtp_pass || ''}
                  onChange={(e) => setConfig({ ...config, smtp_pass: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="smtp_from">发件人地址</Label>
                <Input
                  id="smtp_from"
                  placeholder="noreply@example.com"
                  value={config.smtp_from || ''}
                  onChange={(e) => setConfig({ ...config, smtp_from: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Telegram 配置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Send className="h-5 w-5" />
              Telegram 通知配置
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telegram_bot_token">Bot Token</Label>
                <Input
                  id="telegram_bot_token"
                  placeholder="123456:ABC-DEF..."
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
          </div>

          <Separator />

          {/* AI 配置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI 反垃圾评论配置
            </h3>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="ai_enabled"
                checked={aiConfig?.isEnabled || false}
                onChange={(e) =>
                  setAiConfig((prev) =>
                    prev ? { ...prev, isEnabled: e.target.checked } : null
                  )
                }
                className="h-4 w-4"
              />
              <Label htmlFor="ai_enabled">启用 AI 反垃圾评论功能</Label>
            </div>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="ai_base_url">API Base URL</Label>
                <Input
                  id="ai_base_url"
                  placeholder="https://api.openai.com/v1"
                  value={aiConfig?.baseUrl || ''}
                  onChange={(e) =>
                    setAiConfig((prev) =>
                      prev ? { ...prev, baseUrl: e.target.value } : null
                    )
                  }
                  disabled={!aiConfig?.isEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_model">模型名称</Label>
                <Input
                  id="ai_model"
                  placeholder="gpt-3.5-turbo"
                  value={aiConfig?.model || ''}
                  onChange={(e) =>
                    setAiConfig((prev) => (prev ? { ...prev, model: e.target.value } : null))
                  }
                  disabled={!aiConfig?.isEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_api_key">API Key</Label>
                <Input
                  id="ai_api_key"
                  type="password"
                  placeholder="sk-..."
                  value={aiConfig?.apiKey || ''}
                  onChange={(e) =>
                    setAiConfig((prev) => (prev ? { ...prev, apiKey: e.target.value } : null))
                  }
                  disabled={!aiConfig?.isEnabled}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSaveAllConfigs} disabled={configLoading || aiConfigLoading}>
              {configLoading || aiConfigLoading ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
