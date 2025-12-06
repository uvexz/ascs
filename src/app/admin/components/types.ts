// 管理后台共享类型定义

export interface Site {
  id: string
  hostname: string
  name?: string
  description?: string
  alternateHostnames?: string
  createdAt: string
  _count: {
    comments: number
  }
}

export interface Comment {
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

export interface AIConfig {
  id: string
  baseUrl: string
  model: string
  apiKey: string
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface PaginationInfo {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
