import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrentHost(): string {
  if (typeof window === 'undefined') {
    return 'your-domain.com'
  }
  
  const hostname = window.location.hostname
  const port = window.location.port
  const protocol = window.location.protocol
  
  // 如果是本地开发环境，使用示例域名
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'your-domain.com'
  }
  
  // 构建完整的host地址
  const host = port && port !== '80' && port !== '443' 
    ? `${hostname}:${port}` 
    : hostname
    
  return `${protocol}//${host}`
}