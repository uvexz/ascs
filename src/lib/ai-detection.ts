import { prisma } from './prisma'

interface AIConfig {
  id: string
  baseUrl: string
  model: string
  apiKey: string
  isEnabled: boolean
}

interface DetectionResult {
  isSpam: boolean
  confidence: number
  reason?: string
}

export class AIDetectionService {
  private config: AIConfig | null = null

  async loadConfig(): Promise<boolean> {
    try {
      const aiConfig = await prisma.aIConfig.findFirst({
        where: { isEnabled: true }
      })
      
      if (!aiConfig) {
        return false
      }
      
      this.config = aiConfig
      return true
    } catch (error) {
      console.error('Failed to load AI config:', error)
      return false
    }
  }

  async detectSpam(content: string, author: string, email?: string, website?: string): Promise<DetectionResult> {
    if (!this.config || !this.config.isEnabled) {
      return { isSpam: false, confidence: 0 }
    }

    try {
      const prompt = `
你是一个反垃圾评论系统助手。请分析下面的评论内容，判断是否为垃圾评论。

评论内容: "${content}"
作者: ${author}
邮箱: ${email || '未提供'}
网站: ${website || '未提供'}

请根据以下标准判断：
1. 广告或推广内容
2. 无意义或重复内容
3. 包含恶意链接
4. 包含不当或攻击性言论
5. 明显的机器生成内容

请以 JSON 格式回复，包含以下字段：
{
  "isSpam": true/false,
  "confidence": 0-1之间的置信度,
  "reason": "判断原因（如果isSpam为true）"
}

只返回 JSON 格式，不要包含其他文本。
`

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: '你是一个专业的反垃圾评论助手，只返回JSON格式的结果。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 200,
        }),
      })

      if (!response.ok) {
        console.error('AI detection API error:', response.statusText)
        return { isSpam: false, confidence: 0 }
      }

      const data = await response.json()
      const aiResult = JSON.parse(data.choices[0].message.content)

      return {
        isSpam: aiResult.isSpam,
        confidence: aiResult.confidence,
        reason: aiResult.reason
      }
    } catch (error) {
      console.error('AI detection error:', error)
      return { isSpam: false, confidence: 0 }
    }
  }

  async isSpamComment(content: string, author: string, email?: string, website?: string): Promise<boolean> {
    const detectionResult = await this.detectSpam(content, author, email, website)
    
    if (detectionResult.isSpam && detectionResult.confidence > 0.8) {
      // 高置信度垃圾评论，直接拒绝
      console.log(`Spam comment detected: ${detectionResult.reason}`)
      return true
    }
    
    return false
  }

  async needsModeration(content: string, author: string, email?: string, website?: string): Promise<boolean> {
    const detectionResult = await this.detectSpam(content, author, email, website)
    
    if (detectionResult.isSpam && detectionResult.confidence > 0.5 && detectionResult.confidence <= 0.8) {
      // 中等置信度，需要人工审核
      console.log(`Comment needs moderation: ${detectionResult.reason}`)
      return true
    }
    
    return false
  }
}

export const aiDetectionService = new AIDetectionService()