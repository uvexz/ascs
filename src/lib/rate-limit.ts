// 速率限制工具
// 使用内存存储来跟踪 IP 请求时间

interface RateLimitRecord {
  lastRequest: number
}

class RateLimiter {
  private records: Map<string, RateLimitRecord> = new Map()
  private windowMs: number // 时间窗口（毫秒）
  private maxRequests: number // 最大请求数

  constructor(windowMs: number = 1000, maxRequests: number = 1) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    
    // 定期清理过期的记录，防止内存泄漏
    setInterval(() => this.cleanup(), 60000) // 每分钟清理一次
  }

  /**
   * 检查 IP 是否超过速率限制
   * @param ip 客户端 IP 地址
   * @returns 如果超过限制返回 true，否则返回 false
   */
  isRateLimited(ip: string): boolean {
    const now = Date.now()
    const record = this.records.get(ip)

    if (!record) {
      // 第一次请求，创建记录
      this.records.set(ip, { lastRequest: now })
      return false
    }

    const timeSinceLastRequest = now - record.lastRequest
    
    if (timeSinceLastRequest >= this.windowMs) {
      // 时间窗口已过，重置记录
      record.lastRequest = now
      return false
    }

    // 在时间窗口内，超过限制
    return true
  }

  /**
   * 清理过期的记录
   */
  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.windowMs

    for (const [ip, record] of this.records.entries()) {
      if (record.lastRequest < cutoff) {
        this.records.delete(ip)
      }
    }
  }

  /**
   * 获取当前记录数（用于调试）
   */
  getRecordCount(): number {
    return this.records.size
  }
}

// 创建评论提交的速率限制器（每 3 秒最多 1 次请求）
const commentRateLimiter = new RateLimiter(3000, 1)

export { commentRateLimiter }
export default RateLimiter