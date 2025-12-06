/**
 * 存储适配器接口
 * 用于速率限制和 Cap.js token 存储
 */

export interface StorageAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

/**
 * 内存存储适配器（默认，适用于单实例部署）
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map()

  constructor() {
    // 定期清理过期数据
    setInterval(() => this.cleanup(), 60000)
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    if (!item) return null

    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key)
      return null
    }

    return item.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    this.store.set(key, { value, expiresAt })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.store.delete(key)
      }
    }
  }
}

/**
 * Redis 存储适配器（适用于多实例部署）
 * 需要安装 ioredis: npm install ioredis
 */
export class RedisStorageAdapter implements StorageAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null
  private connectionPromise: Promise<void> | null = null
  private fallbackStorage: MemoryStorageAdapter | null = null

  constructor(private redisUrl: string) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (this.client) return this.client
    if (this.fallbackStorage) return null

    if (!this.connectionPromise) {
      this.connectionPromise = this.connect()
    }

    await this.connectionPromise
    return this.client
  }

  private async connect(): Promise<void> {
    try {
      // 动态导入 ioredis（可选依赖）
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis')
      this.client = new Redis(this.redisUrl)
      console.log('Redis connected successfully')
    } catch (error) {
      console.warn('ioredis not installed, falling back to memory storage:', error)
      this.fallbackStorage = new MemoryStorageAdapter()
    }
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient()
    if (!client && this.fallbackStorage) {
      return this.fallbackStorage.get(key)
    }
    return client?.get(key) ?? null
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient()
    if (!client && this.fallbackStorage) {
      return this.fallbackStorage.set(key, value, ttlSeconds)
    }
    if (ttlSeconds) {
      await client?.setex(key, ttlSeconds, value)
    } else {
      await client?.set(key, value)
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient()
    if (!client && this.fallbackStorage) {
      return this.fallbackStorage.delete(key)
    }
    await client?.del(key)
  }

  async exists(key: string): Promise<boolean> {
    const client = await this.getClient()
    if (!client && this.fallbackStorage) {
      return this.fallbackStorage.exists(key)
    }
    const result = await client?.exists(key)
    return result === 1
  }
}

/**
 * 获取存储适配器实例
 * 根据环境变量自动选择内存或 Redis 存储
 */
let storageInstance: StorageAdapter | null = null

export function getStorageAdapter(): StorageAdapter {
  if (storageInstance) return storageInstance

  const redisUrl = process.env.REDIS_URL

  if (redisUrl) {
    console.log('Using Redis storage adapter')
    storageInstance = new RedisStorageAdapter(redisUrl)
  } else {
    console.log('Using memory storage adapter (set REDIS_URL for Redis)')
    storageInstance = new MemoryStorageAdapter()
  }

  return storageInstance
}
