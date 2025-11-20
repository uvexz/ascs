import { NextRequest, NextResponse } from 'next/server'

export function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

export function handleCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin || undefined)
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

export function createCorsResponse(data: any, options: { status?: number; headers?: Record<string, string> } = {}) {
  const response = NextResponse.json(data, { status: options.status || 200 })
  
  // 添加 CORS 头
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // 添加自定义头
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }
  
  return response
}

export function handleOptions() {
  const response = new NextResponse(null, { status: 200 })
  
  Object.entries(corsHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}