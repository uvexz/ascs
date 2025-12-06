/**
 * 速率限制工具
 * 支持内存存储（单实例）和 Redis 存储（多实例）
 */

import { getStorageAdapter, StorageAdapter } from './storage'

class RateLimiter {
  private storage: StorageAdapter
  private windowMs: number // 时间窗口（毫秒）
  private keyPrefix: string

  constructor(windowMs: number = 1000, keyPrefix: string = 'ratelimit') {
    this.windowMs = windowMs
    this.keyPrefix = keyPrefix
    this.storage = getStorageAdapter()
  }

  /**
   * 检查 IP 是否超过速率限制
   * @param ip 客户端 IP 地址
   * @returns 如果超过限制返回 true，否则返回 false
   */
  async isRateLimited(ip: string): Promise<boolean> {
    const key = `${this.keyPrefix}:${ip}`
    const now = Date.now()

    const lastRequestStr = await this.storage.get(key)

    if (!lastRequestStr) {
      // 第一次请求，创建记录
      await this.storage.set(key, now.toString(), Math.ceil(this.windowMs / 1000))
      return false
    }

    const lastRequest = parseInt(lastRequestStr, 10)
    const timeSinceLastRequest = now - lastRequest

    if (timeSinceLastRequest >= this.windowMs) {
      // 时间窗口已过，重置记录
      await this.storage.set(key, now.toString(), Math.ceil(this.windowMs / 1000))
      return false
    }

    // 在时间窗口内，超过限制
    return true
  }

}

// 创建评论提交的速率限制器（每 3 秒最多 1 次请求）
const commentRateLimiter = new RateLimiter(3000, 'comment')

export { commentRateLimiter }
export default RateLimiter
