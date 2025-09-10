import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createCorsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hostname = searchParams.get('host')

    if (!hostname) {
      return createCorsResponse(
        { error: 'host parameter is required' },
        { status: 400 }
      )
    }

    let site = await prisma.site.findUnique({
      where: { hostname },
    })

    // 如果站点不存在，自动创建一个
    if (!site) {
      site = await prisma.site.create({
        data: {
          hostname,
          name: hostname,
        },
      })
    }

    return createCorsResponse(site)
  } catch (error) {
    console.error('Error fetching site:', error)
    return createCorsResponse(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}