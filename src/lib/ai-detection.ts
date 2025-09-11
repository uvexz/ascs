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
你是一个反垃圾评论系统助手。请分析下面的评论内容，评估其为垃圾评论的风险度。

评论内容: "${content}"
作者: ${author}
邮箱: ${email || '未提供'}
网站: ${website || '未提供'}

评估标准：
1. 广告或推广内容
2. 无意义或重复内容
3. 包含恶意链接
4. 包含不当或攻击性言论
5. 明显的机器生成内容

请只返回一个 0-1 之间的数字，表示垃圾评论的风险度：
- 0.0-0.3：正常评论，风险很低
- 0.3-0.7：可能有问题，需要进一步检查
- 0.7-1.0：很可能是垃圾评论

只返回数字，不要包含任何其他文本或解释。
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
            { role: 'system', content: '你是一个专业的反垃圾评论助手，只返回0-1之间的数字表示风险度。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          max_tokens: 10,
        }),
      })

      if (!response.ok) {
        console.error('AI detection API error:', response.statusText)
        return { isSpam: false, confidence: 0 }
      }

      const data = await response.json()
      
      // 检查响应结构
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Invalid AI API response structure')
        return { isSpam: false, confidence: 0 }
      }
      
      const messageContent = data.choices[0].message.content.trim()
      
      // 尝试从响应中提取数字
      let riskScore = 0
      const numberMatch = messageContent.match(/0?\.\d+|[01]/)
      if (numberMatch) {
        riskScore = parseFloat(numberMatch[0])
        // 确保数字在 0-1 范围内
        riskScore = Math.max(0, Math.min(1, riskScore))
      } else {
        console.error('Failed to extract risk score from AI response:', messageContent)
        return { isSpam: false, confidence: 0 }
      }

      // 根据风险度判断是否为垃圾评论
      const isSpam = riskScore > 0.7
      const confidence = riskScore
      const reason = riskScore > 0.7 ? `高风险评论 (${riskScore.toFixed(2)})` :
                    riskScore > 0.3 ? `中风险评论 (${riskScore.toFixed(2)})` :
                    `低风险评论 (${riskScore.toFixed(2)})`

      return {
        isSpam,
        confidence,
        reason
      }
    } catch (error) {
      console.error('AI detection error:', error)
      return { isSpam: false, confidence: 0 }
    }
  }

  async isSpamComment(content: string, author: string, email?: string, website?: string): Promise<boolean> {
    const detectionResult = await this.detectSpam(content, author, email, website)
    
    if (detectionResult.confidence > 0.7) {
      // 高风险度垃圾评论，直接拒绝
      console.log(`Spam comment detected: ${detectionResult.reason}`)
      return true
    }
    
    return false
  }

  async needsModeration(content: string, author: string, email?: string, website?: string): Promise<boolean> {
    const detectionResult = await this.detectSpam(content, author, email, website)
    
    if (detectionResult.confidence > 0.3 && detectionResult.confidence <= 0.7) {
      // 中等风险度，需要人工审核
      console.log(`Comment needs moderation: ${detectionResult.reason}`)
      return true
    }
    
    return false
  }
}

export const aiDetectionService = new AIDetectionService()