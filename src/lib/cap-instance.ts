import Cap from '@cap.js/server'
import { getStorageAdapter } from './storage'

/**
 * Cap.js 存储适配器
 * 将我们的存储适配器转换为 Cap.js 兼容的格式
 */
class CapStorageAdapter {
  private storage = getStorageAdapter()
  private keyPrefix = 'cap'

  async get(key: string): Promise<string | null> {
    return this.storage.get(`${this.keyPrefix}:${key}`)
  }

  async set(key: string, value: string): Promise<void> {
    // Cap.js tokens 默认 5 分钟过期
    await this.storage.set(`${this.keyPrefix}:${key}`, value, 300)
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(`${this.keyPrefix}:${key}`)
  }
}

// 检查是否配置了 Redis
const redisUrl = process.env.REDIS_URL

// 创建 Cap 实例
// 如果配置了 Redis，使用自定义存储适配器
// 否则使用默认的文件存储
let capInstance: InstanceType<typeof Cap>

if (redisUrl) {
  console.log('Cap.js: Using Redis storage')
  const storage = new CapStorageAdapter()
  capInstance = new Cap({
    // @ts-expect-error Cap.js 类型定义可能不完整
    tokenStore: {
      get: (key: string) => storage.get(key),
      set: (key: string, value: string) => storage.set(key, value),
      delete: (key: string) => storage.delete(key),
    },
  })
} else {
  console.log('Cap.js: Using default file storage')
  capInstance = new Cap()
}

export { capInstance }
